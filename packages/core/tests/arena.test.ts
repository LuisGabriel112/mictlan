import { expect, test } from 'vitest';
import { applyAura } from '../src/auras.js';
import { BOSS, BOSS_ABILITIES } from '../src/data/boss.js';
import { CLASSES, COMBAT_RULES } from '../src/data/classes.js';
import { step } from '../src/encounter.js';
import { advanceArena, endEncounter } from '../src/mechanics/arena.js';
import { summonXolos } from '../src/mechanics/xolos.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { repeatTick } from './enemy-fixtures.js';

function arenaEncounter() {
  const state = combatEncounter();
  state.bossActive = true;
  state.phase = 3;
  state.phaseElapsedTicks = BOSS.finalPhaseArena.shrinkDurationTicks;
  state.safeRadiusMeters = BOSS.finalPhaseArena.safeRadiusMeters;
  return state;
}

test('C1: phase 3 starts at the wall, reaches 16 m at 5 s and stays at 12 m from 10 s', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.entities.boss.health = 7200;
  for (const id of ['p1', 'p2', 'p3']) Object.assign(initial.entities[id], { x: 12, y: 0 });
  const entered = combatTick(initial).state;
  expect(entered).toMatchObject({ phase: 3, phaseElapsedTicks: 0, safeRadiusMeters: 20 });
  // Isolate the arena clock from scheduled boss abilities.
  const first = combatTick({ ...entered, bossAbilityTimers: {} }).state;
  expect(first).toMatchObject({ phaseElapsedTicks: 1, safeRadiusMeters: 19.96 });
  const halfway = repeatTick(first, 99).state;
  expect(halfway).toMatchObject({ phaseElapsedTicks: 100, safeRadiusMeters: 16 });
  const finished = repeatTick(halfway, 100).state;
  expect(finished).toMatchObject({ phaseElapsedTicks: 200, safeRadiusMeters: 12 });
  expect(repeatTick(finished, 100).state).toMatchObject({ phaseElapsedTicks: 300, safeRadiusMeters: 12 });
});

test.each([1, 2] as const)('outside phase 3 the safe radius is the wall in phase %s', (phase) => {
  const initial = arenaEncounter();
  initial.phase = phase;
  freezeCombat(initial);
  const result = combatTick(initial);
  expect(result.state.safeRadiusMeters).toBe(COMBAT_RULES.arena.wallRadiusMeters);
  expect(result.events).toEqual([]);
  for (const id of Object.keys(initial.entities)) expect(result.state.entities[id]).toBe(initial.entities[id]);
});

test('C2: unsafe ground deals 5 each tick and 100 per second, including a shielded Jaguar under enrage', () => {
  const initial = arenaEncounter();
  initial.critChance = 1;
  initial.enraged = true;
  const before = structuredClone(initial);
  freezeCombat(initial);
  const first = combatTick(initial, [combatCast('obsidianShield', 'p1')]);
  const rest = repeatTick(first.state, COMBAT_RULES.ticksPerSecond - 1);
  const damage = [...first.events, ...rest.events].filter((event) => event.type === 'damage');
  expect(damage).toHaveLength(60);
  for (const id of ['p1', 'p2', 'p3']) {
    expect(rest.state.entities[id].health).toBe(initial.entities[id].health - 100);
    expect(damage.filter((event) => event.targetId === id)).toEqual(
      Array.from({ length: 20 }, (_, index) => ({
        type: 'damage', sourceId: 'environment', abilityId: 'unsafeGround', targetId: id,
        amount: 5, critical: false, tick: index + 1,
      })),
    );
  }
  expect(rest.state.entities.p1.auras[0]?.definition.id).toBe('obsidianShield');
  expect(rest.state.entities.boss).toBe(initial.entities.boss);
  expect(rest.state.rngState).toBe(initial.rngState);
  expect(initial).toEqual(before);
});

test('arena measures centers, includes the boundary, skips corpses and enemies, and preserves unchanged references', () => {
  const initial = arenaEncounter();
  Object.assign(initial.entities.p1, { x: 0, y: 12 });
  Object.assign(initial.entities.p2, { x: 12.1, y: 0 });
  initial.entities.p3.health = 0;
  initial.entities.boss.x = 19;
  const before = structuredClone(initial);
  freezeCombat(initial);
  const result = advanceArena(initial);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ targetId: 'p2', amount: 5 });
  expect(result.state.entities.p2.health).toBe(initial.entities.p2.health - 5);
  for (const id of ['p1', 'p3', BOSS.id]) expect(result.state.entities[id]).toBe(initial.entities[id]);
  expect(initial).toEqual(before);
  expect(result).toEqual(advanceArena(initial));
});

test.each(['victory', 'defeat', 'both'] as const)('C3: %s is decided at tick end with victory taking priority', (condition) => {
  const initial = arenaEncounter();
  initial.entities.p1.health = 0;
  initial.entities.p2.health = 0;
  if (condition !== 'victory') initial.entities.p3.health = 5;
  if (condition !== 'defeat') {
    initial.entities.boss.health = 70;
    combatPlayer(initial).targetId = BOSS.id;
  }
  const result = combatTick(initial, condition === 'defeat' ? [] : [combatCast('quickShot')]);
  const outcome = condition === 'defeat' ? 'defeat' : 'victory';
  expect(result.state.status).toBe(outcome);
  expect(result.events.filter(({ type }) => type === 'encounterEnded')).toEqual([
    { type: 'encounterEnded', outcome, tick: 1 },
  ]);
  expect(result.events.at(-1)).toEqual({ type: 'encounterEnded', outcome, tick: 1 });
  if (condition === 'both') {
    expect(result.state.entities.boss.health).toBe(0);
    expect(result.state.entities.p3.health).toBe(0);
    expect(result.events.filter(({ type }) => type === 'death')).toHaveLength(2);
  }
  expect(endEncounter(result.state)).toEqual({ state: result.state, events: [] });
  expect(repeatTick(result.state, 3).events).toEqual([]);
});

test('victory allows surviving xolos and boss health below zero', () => {
  const initial = summonXolos(arenaEncounter());
  initial.entities.boss.health = -1;
  const result = combatTick(initial);
  expect(Object.values(result.state.entities).filter((entity) => entity.type === 'xolo' && entity.health > 0)).toHaveLength(2);
  expect(result.state.status).toBe('victory');
});

test.each(['victory', 'defeat'] as const)('C4: after %s only tick advances despite inputs, casts, auras, zones and timers', (status) => {
  const initial = arenaEncounter();
  initial.status = status;
  readyCast(initial, 'obsidianArrow', 'p3', BOSS.id);
  initial.entities.p1 = applyAura(initial.entities.p1, CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  combatPlayer(initial, 'p2').mana = 0;
  combatPlayer(initial).gcdRemainingTicks = 10;
  combatPlayer(initial).cooldowns = { flight: 10 };
  initial.bossAbilityTimers = { lamentOfTheDead: 1 };
  initial.bossAbilityQueue = ['flayedStrike'];
  initial.zones = [{
    id: 'wind', sourceId: BOSS.id, abilityId: 'obsidianWind', x: 0, y: -15,
    radiusMeters: 4, remainingTicks: 1, baseDamage: 200,
  }];
  const before = structuredClone(initial);
  freezeCombat(initial);
  let current = initial;
  for (let tick = 1; tick <= 3; tick += 1) {
    const result = combatTick(current, [
      { type: 'move', playerId: 'p1', dx: 1, dy: 0 },
      { type: 'target', playerId: 'p1', entityId: BOSS.id },
      combatCast('quickShot'),
    ]);
    expect(result.events).toEqual([]);
    expect(result.state).toEqual({ ...initial, tick });
    expect(result.state.entities).toBe(initial.entities);
    expect(result.state.zones).toBe(initial.zones);
    expect(result.state.bossAbilityTimers).toBe(initial.bossAbilityTimers);
    expect(result.state.bossAbilityQueue).toBe(initial.bossAbilityQueue);
    current = result.state;
  }
  expect(initial).toEqual(before);
  expect(() => step(initial, [], COMBAT_RULES.tickDurationMs + 1)).toThrow();
});

test('C5: death identifies the lethal enemy or arena hit; arena runs after enemies and clears casts and auras', () => {
  const initial = arenaEncounter();
  initial.entities.p1 = applyAura(initial.entities.p1, CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  initial.entities.p1.health = 92;
  initial.entities.p2.health = 1;
  initial.entities.p1.cast = {
    abilityId: 'obsidianArrow', targetId: BOSS.id, durationTicks: 40, remainingTicks: 10, interruptible: false,
  };
  initial.entities.boss.cast = {
    abilityId: 'lamentOfTheDead', targetId: null, durationTicks: BOSS_ABILITIES.lamentOfTheDead.castTicks,
    remainingTicks: 1, interruptible: true,
  };
  const result = combatTick(initial);
  expect(result.events.filter(({ type }) => type === 'death')).toEqual([
    { type: 'death', entityId: 'p2', sourceId: BOSS.id, abilityId: 'lamentOfTheDead', tick: 1 },
    { type: 'death', entityId: 'p1', sourceId: 'environment', abilityId: 'unsafeGround', tick: 1 },
  ]);
  expect(result.state.entities.p1).toMatchObject({ health: 0, cast: null, auras: [] });
  expect(result.events.filter((event) => event.type === 'damage').filter((event) => event.abilityId === 'unsafeGround')
    .map((event) => event.targetId)).toEqual(['p1', 'p3']);
});
