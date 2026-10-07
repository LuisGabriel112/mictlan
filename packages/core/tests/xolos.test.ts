import { expect, test } from 'vitest';
import { BOSS, BOSS_ABILITIES, BOSS_PHASES, XOLO } from '../src/data/boss.js';
import { COMBAT_RULES } from '../src/data/classes.js';
import { createEncounter } from '../src/encounter.js';
import { summonXolos } from '../src/mechanics/xolos.js';
import { nextRandom } from '../src/rng.js';
import type { EncounterState, EnemyEntity, PlayerCount } from '../src/types.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { repeatTick } from './enemy-fixtures.js';

function xolos(state: EncounterState): EnemyEntity[] {
  return Object.values(state.entities).filter((entity): entity is EnemyEntity => entity.type === 'xolo');
}

function enterPhaseTwo(playerCount: PlayerCount = 3): EncounterState {
  const initial = createEncounter({ critChance: 0, players: [
    { id: 'p1', classId: 'jaguar' }, { id: 'p2', classId: 'healer' },
    ...Array.from({ length: playerCount - 2 }, (_, index) => ({ id: `p${index + 3}`, classId: 'eagle' as const })),
  ] }, 42);
  initial.bossActive = true;
  initial.entities.boss.health = initial.entities.boss.maxHealth
    * BOSS_PHASES[2].healthThresholdBps / COMBAT_RULES.basisPointsScale;
  const entered = combatTick(initial);
  expect(entered.state).toMatchObject({ phase: 2, phaseElapsedTicks: 0 });
  expect(xolos(entered.state)).toEqual([]);
  return entered.state;
}

test.each([{ players: 3, health: 300 }, { players: 5, health: 600 }] as const)(
  'C1: phase 2 summons two opposite wall xolos with $health health for $players players', ({ players, health }) => {
    const initial = enterPhaseTwo(players);
    freezeCombat(initial);
    const result = combatTick(initial);
    const pair = xolos(result.state);
    expect(pair).toHaveLength(2);
    for (const xolo of pair) {
      expect(Math.hypot(xolo.x, xolo.y)).toBeCloseTo(20, 12);
      expect(xolo).toMatchObject({ health, maxHealth: health, armorBps: 0, bodyRadiusMeters: 0.5,
        speedMetersPerSecond: 5, cast: null, autoAttackRemainingTicks: 0 });
    }
    expect(pair[0].x).toBeCloseTo(-pair[1].x, 12);
    expect(pair[0].y).toBeCloseTo(-pair[1].y, 12);
    expect(result.events).toEqual([{ type: 'abilityResolved', sourceId: BOSS.id,
      abilityId: 'callOfTheXolos', targetId: null, tick: initial.tick + 1 }]);
    expect(result.state.bossAbilityTimers.callOfTheXolos).toBe(800);
  },
);

test('C2: each xolo targets the living healer, otherwise the nearest living player at its spawn', () => {
  const initial = enterPhaseTwo();
  const preview = xolos(combatTick(initial).state);
  Object.assign(initial.entities.p1, { x: preview[0].x, y: preview[0].y });
  Object.assign(initial.entities.p3, { x: preview[1].x, y: preview[1].y });
  const preferred = xolos(combatTick(initial).state);
  for (const xolo of preferred) {
    expect(xolo).toMatchObject({ targetId: 'p2', threat: { p2: 1 } });
  }
  expect(preferred[0].threat).not.toBe(preferred[1].threat);
  initial.entities.p2.health = 0;
  freezeCombat(initial);
  const fallback = xolos(combatTick(initial).state);
  expect(fallback[0]).toMatchObject({ targetId: 'p1', threat: { p1: 1 }, health: 300 });
  expect(fallback[1]).toMatchObject({ targetId: 'p3', threat: { p3: 1 }, health: 300 });
});

test('nearest-player ties use the lower id independently of entity insertion order', () => {
  const initial = enterPhaseTwo();
  initial.entities.p2.health = 0;
  for (const id of ['p1', 'p3']) Object.assign(initial.entities[id], { x: 0, y: 0 });
  initial.entities = Object.fromEntries(Object.entries(initial.entities).reverse());
  freezeCombat(initial);
  for (const xolo of xolos(combatTick(initial).state)) {
    expect(xolo).toMatchObject({ targetId: 'p1', threat: { p1: 1 } });
  }
});

test.each(['roar', 'taunt'] as const)('C3: %s switches a summoned xolo from healer to Jaguar', (abilityId) => {
  const initial = combatTick(enterPhaseTwo()).state;
  const [target, other] = xolos(initial);
  Object.assign(combatPlayer(initial, 'p1'), { x: target.x, y: target.y,
    targetId: target.id, autoAttackRemainingTicks: 100 });
  freezeCombat(initial);
  const result = combatTick(initial, [combatCast(abilityId, 'p1')]);
  const affected = xolos(result.state).find(({ id }) => id === target.id);
  expect(affected?.targetId).toBe('p1');
  expect(affected?.threat.p1).toBe(abilityId === 'roar' ? 125 : 1.1);
  expect(affected?.forcedTargetRemainingTicks).toBe(abilityId === 'taunt' ? 60 : 0);
  expect(xolos(result.state).find(({ id }) => id === other.id)).toMatchObject({ targetId: 'p2', threat: { p2: 1 } });
});

test('C4: phase 3 stops summoning while living xolos keep pursuing and attacking', () => {
  const initial = combatTick(enterPhaseTwo()).state;
  initial.entities.boss.health = 7200;
  Object.assign(initial.entities.p2, { x: 0, y: 0, health: 100000, maxHealth: 100000 });
  const entered = combatTick(initial);
  expect(entered.state.phase).toBe(3);
  expect(entered.state.bossAbilityTimers.callOfTheXolos).toBeUndefined();
  const pair = xolos(entered.state);
  const moved = combatTick(entered.state);
  for (const xolo of xolos(moved.state)) {
    const before = entered.state.entities[xolo.id];
    expect(Math.hypot(xolo.x - before.x, xolo.y - before.y)).toBeCloseTo(0.25, 12);
    expect(Math.hypot(xolo.x, xolo.y)).toBeLessThan(Math.hypot(before.x, before.y));
  }
  const result = repeatTick(moved.state, BOSS_PHASES[2].timers.callOfTheXolos.intervalTicks);
  expect(xolos(result.state).map(({ id }) => id)).toEqual(pair.map(({ id }) => id));
  expect(result.events.some((event) => 'abilityId' in event && event.abilityId === 'callOfTheXolos')).toBe(false);
  for (const xolo of pair) {
    const attacks = result.events.filter((event) => event.type === 'damage' && event.sourceId === xolo.id);
    expect(attacks.length).toBeGreaterThan(1);
    expect(attacks[0]).toMatchObject({ abilityId: 'autoAttack', targetId: 'p2', amount: 25, critical: false });
    expect(attacks[1].tick - attacks[0].tick).toBe(XOLO.autoAttack.intervalTicks);
    expect(result.state.entities[xolo.id].cast).toBeNull();
  }
});

test('C5: exactly 40 seconds after the first call a second pair has distinct ids', () => {
  const first = combatTick(enterPhaseTwo()).state;
  const originalIds = xolos(first).map(({ id }) => id);
  // Isolate the call timer from other boss damage during this scheduling test.
  first.bossAbilityTimers = { callOfTheXolos: first.bossAbilityTimers.callOfTheXolos };
  Object.assign(first.entities.p2, { health: 100000, maxHealth: 100000 });
  const before = repeatTick(first, BOSS_PHASES[2].timers.callOfTheXolos.intervalTicks - 1);
  expect(xolos(before.state)).toHaveLength(2);
  expect(before.events.some((event) => 'abilityId' in event && event.abilityId === 'callOfTheXolos')).toBe(false);
  const second = combatTick(before.state);
  expect(second.state.tick - first.tick).toBe(800);
  const all = xolos(second.state);
  expect(all).toHaveLength(4);
  expect(new Set(all.map(({ id }) => id)).size).toBe(4);
  const newPair = all.filter(({ id }) => !originalIds.includes(id));
  expect(newPair).toHaveLength(BOSS_ABILITIES.callOfTheXolos.effect.count);
  for (const xolo of newPair) expect(Math.hypot(xolo.x, xolo.y)).toBeCloseTo(20, 12);
  expect(newPair[0].x).toBeCloseTo(-newPair[1].x, 12);
  expect(newPair[0].y).toBeCloseTo(-newPair[1].y, 12);
});

test('summoning uses one state RNG roll, is immutable and preserves unchanged entity references', () => {
  const initial = enterPhaseTwo();
  const original = structuredClone(initial);
  freezeCombat(initial);
  const result = combatTick(initial);
  expect(initial).toEqual(original);
  expect(result).toEqual(combatTick(initial));
  const roll = nextRandom(initial.rngState);
  const first = xolos(result.state)[0];
  expect(result.state.rngState).toBe(roll.rngState);
  expect(first.x).toBeCloseTo(Math.cos(roll.value * 2 * Math.PI) * 20, 12);
  expect(first.y).toBeCloseTo(Math.sin(roll.value * 2 * Math.PI) * 20, 12);
  for (const id of Object.keys(initial.entities)) expect(result.state.entities[id]).toBe(initial.entities[id]);
  const otherSeed = combatTick({ ...initial, rngState: 123 });
  expect(xolos(otherSeed.state)[0].x).not.toBe(first.x);
});

test('ids skip player collisions and retained corpses, even for repeated calls in one tick', () => {
  const initial = createEncounter({ critChance: 0, players: [
    { id: 'xolo:0', classId: 'jaguar' }, { id: 'p2', classId: 'healer' }, { id: 'p3', classId: 'eagle' },
  ] }, 42);
  const first = summonXolos(initial);
  const corpse = xolos(first)[0];
  corpse.health = 0;
  freezeCombat(first);
  const second = summonXolos(first);
  expect(xolos(second)).toHaveLength(4);
  expect(second.entities['xolo:0']).toBe(initial.entities['xolo:0']);
  expect(second.entities[corpse.id]).toBe(corpse);
  expect(new Set(Object.values(second.entities).map(({ id }) => id)).size).toBe(8);
});

test('xolos act without boss pull; corpses remain inert and are excluded from healing threat', () => {
  const initial = summonXolos(combatEncounter());
  const [living, corpse] = xolos(initial);
  corpse.health = 0;
  initial.entities.p1.health -= 120;
  readyCast(initial, 'remedy', 'p2', 'p1');
  // Isolate healing from the boss scheduler while still including the living boss in threat sharing.
  initial.bossActive = true;
  freezeCombat(initial);
  const healed = combatTick(initial);
  expect(healed.state.entities[corpse.id]).toBe(corpse);
  const enemy = xolos(healed.state).find(({ id }) => id === living.id);
  expect(enemy?.threat.p2).toBe(31);
  const boss = healed.state.entities.boss;
  if (boss.type !== 'boss') throw new Error('Missing boss');
  expect(boss.threat.p2).toBe(30);
  expect(healed.events.some((event) => 'sourceId' in event && event.sourceId === corpse.id)).toBe(false);

  const unpulled = summonXolos(combatEncounter());
  freezeCombat(unpulled);
  const moved = combatTick(unpulled);
  expect(moved.state.bossActive).toBe(false);
  for (const xolo of xolos(moved.state)) {
    const before = unpulled.entities[xolo.id];
    expect(Math.hypot(xolo.x - before.x, xolo.y - before.y)).toBeCloseTo(0.25, 12);
  }
});

test.each([{ threat: 130, target: 'p2' }, { threat: 131, target: 'p3' }])(
  'summoned xolos apply normal ranged threat hysteresis at $threat', ({ threat, target }) => {
    const initial = combatTick(enterPhaseTwo()).state;
    const [xolo] = xolos(initial);
    Object.assign(initial.entities.p3, { x: 0, y: 0 });
    xolo.threat = { p2: 100, p3: threat };
    freezeCombat(initial);
    expect(combatTick(initial).state.entities[xolo.id].targetId).toBe(target);
  },
);
