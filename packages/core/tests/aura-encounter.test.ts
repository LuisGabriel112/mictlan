import { expect, test } from 'vitest';
import { applyAura, damageTakenModifiers } from '../src/auras.js';
import { calculateDamage } from '../src/combat.js';
import { advanceAuraEffects, resolveCombatEffects } from '../src/combat-effects.js';
import { BOSS, BOSS_ABILITIES } from '../src/data/boss.js';
import { CLASSES } from '../src/data/classes.js';
import { nextRandom } from '../src/rng.js';
import type { CombatEvent, EncounterState } from '../src/types.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';

function advanceTicks(state: EncounterState, ticks: number) {
  const events: CombatEvent[] = [];
  for (let elapsed = 0; elapsed < ticks; elapsed += 1) {
    const result = combatTick(state);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

function castCopal(state = combatEncounter()) {
  return combatTick(state, [
    { type: 'target', playerId: 'p2', entityId: 'p1' }, combatCast('copal', 'p2'),
  ]);
}

test('C1: Copal heals 200 over ten seconds in ten pulses of 20 starting after one second', () => {
  const initial = combatEncounter();
  initial.entities.p1.health = 900;
  const applied = castCopal(initial);
  expect(applied.events.map(({ type }) => type)).toEqual(['abilityResolved']);
  const waiting = advanceTicks(applied.state, 19);
  expect(waiting.events).toEqual([]);
  const result = advanceTicks(waiting.state, 181);
  expect(result.events).toEqual(Array.from({ length: 10 }, (_, index) => ({
    type: 'healing', tick: applied.state.tick + (index + 1) * 20, sourceId: 'p2', abilityId: 'copal',
    targetId: 'p1', amount: 20, effectiveAmount: 20, critical: false,
  })));
  expect(result.state.entities.p1).toMatchObject({ health: 1100, auras: [] });
  expect(threatEnemy(result.state).threat).toEqual({ p2: 100 });
  expect(advanceTicks(result.state, 20).events).toEqual([]);
});

test('C2: refreshing Copal resets duration and pulse rhythm without stacking', () => {
  const initial = combatEncounter();
  initial.entities.p1.health = 800;
  const first = advanceTicks(castCopal(initial).state, 30);
  expect(first.events).toHaveLength(1);
  const refreshed = castCopal(first.state);
  expect(refreshed.state.entities.p1.auras).toHaveLength(1);
  expect(refreshed.state.entities.p1.auras[0]).toMatchObject({ remainingTicks: 200, ticksUntilNextEffect: 20 });
  const waiting = advanceTicks(refreshed.state, 19);
  expect(waiting.events).toEqual([]);
  const result = advanceTicks(waiting.state, 181);
  expect(result.events).toHaveLength(10);
  expect(result.events.map(({ tick }) => tick)).toEqual(Array.from({ length: 10 }, (_, index) => refreshed.state.tick + (index + 1) * 20));
  expect(result.state.entities.p1).toMatchObject({ health: 1020, auras: [] });
  expect(advanceTicks(result.state, 20).events).toEqual([]);
});

test('C3: Shield expires at exactly six seconds or 120 ticks after applying the ability', () => {
  const initial = combatEncounter();
  const applied = combatTick(initial, [combatCast('obsidianShield', 'p1')]);
  expect(applied.state.entities.p1.auras[0]).toMatchObject({ remainingTicks: 120, ticksUntilNextEffect: null });
  expect(applied.state.rngState).toBe(initial.rngState);
  const last = advanceTicks(applied.state, 119).state;
  expect(last.entities.p1.auras[0].remainingTicks).toBe(1);
  expect(damageTakenModifiers(last.entities.p1)).toEqual([5000]);
  const expired = combatTick(last);
  expect(expired.state.tick - applied.state.tick).toBe(120);
  expect(expired.state.entities.p1.auras).toEqual([]);
  expect(damageTakenModifiers(expired.state.entities.p1)).toEqual([]);
  expect(expired.events).toEqual([]);
});

test('C4: Flayed Strike deals 140 to the Jaguar with Shield applied by the real ability', () => {
  const applied = combatTick(combatEncounter(), [combatCast('obsidianShield', 'p1')]);
  const target = applied.state.entities.p1;
  const baseDamage = BOSS_ABILITIES.flayedStrike.effect.baseDamage;
  expect(target.auras[0].definition).toBe(CLASSES.jaguar.abilities[2].effect.aura);
  expect(calculateDamage(baseDamage, target.armorBps, damageTakenModifiers(target))).toBe(140);
  const expired = advanceTicks(applied.state, 120).state.entities.p1;
  expect(calculateDamage(baseDamage, expired.armorBps, damageTakenModifiers(expired))).toBe(280);
});

test('advanceAuraEffects reuses untouched encounter and entity references without consuming RNG', () => {
  const state = combatEncounter();
  freezeCombat(state);
  const result = advanceAuraEffects(state);
  expect(result.state).toBe(state);
  expect(result.events).toEqual([]);
  const ticked = combatTick(state).state;
  for (const id of Object.keys(state.entities)) expect(ticked.entities[id]).toBe(state.entities[id]);
  expect(ticked.entities).toBe(state.entities);
});

test('Copal can critically heal and advances the RNG exactly once per pulse', () => {
  const initial = combatEncounter(1);
  initial.entities.p1.health = 1000;
  const applied = castCopal(initial);
  expect(applied.state.rngState).toBe(initial.rngState);
  const first = advanceTicks(applied.state, 20);
  expect(first.events[0]).toMatchObject({ type: 'healing', critical: true, amount: 30, effectiveAmount: 30 });
  expect(first.state.rngState).toBe(nextRandom(initial.rngState).rngState);
  const second = advanceTicks(first.state, 20);
  expect(second.events[0]).toMatchObject({ critical: true, amount: 30 });
  expect(second.state.rngState).toBe(nextRandom(first.state.rngState).rngState);
});

test('Copal generates shared threat only for effective healing and excludes dead enemies', () => {
  const initial = combatEncounter();
  initial.entities.p1.health = 1195;
  initial.entities.xolo = { ...threatEnemy(initial), id: 'xolo', type: 'xolo', threat: {} };
  initial.entities.dead = { ...threatEnemy(initial), id: 'dead', health: 0 };
  const first = advanceTicks(castCopal(initial).state, 20);
  expect(first.events[0]).toMatchObject({ amount: 20, effectiveAmount: 5, abilityId: 'copal', sourceId: 'p2' });
  expect(first.state.entities.p1.health).toBe(1200);
  expect(threatEnemy(first.state).threat).toEqual({ p2: 1.25 });
  expect(threatEnemy(first.state, 'xolo').threat).toEqual({ p2: 1.25 });
  expect(first.state.entities.dead).toBe(initial.entities.dead);
  const second = advanceTicks(first.state, 20);
  expect(second.events[0]).toMatchObject({ amount: 20, effectiveAmount: 0 });
  expect(threatEnemy(second.state)).toBe(threatEnemy(first.state));
});

test('a due Copal pulse resolves before a completed healing cast', () => {
  const initial = combatEncounter();
  initial.entities.p1.health = 1190;
  const waiting = advanceTicks(castCopal(initial).state, 19).state;
  readyCast(waiting, 'remedy', 'p2', 'p1');
  const result = combatTick(waiting);
  expect(result.events.map(({ type }) => type)).toEqual(['healing', 'castFinished', 'abilityResolved', 'healing']);
  expect(result.events[0]).toMatchObject({ abilityId: 'copal', effectiveAmount: 10 });
  expect(result.events.at(-1)).toMatchObject({ abilityId: 'remedy', effectiveAmount: 0 });
});

test('a due Copal pulse resolves before refreshing in the same tick', () => {
  const initial = combatEncounter();
  initial.entities.p1.health = 1000;
  const waiting = advanceTicks(castCopal(initial).state, 19).state;
  const refreshed = castCopal(waiting);
  expect(refreshed.events.map(({ type }) => type)).toEqual(['healing', 'abilityResolved']);
  expect(refreshed.state.entities.p1.auras[0]).toMatchObject({ remainingTicks: 200, ticksUntilNextEffect: 20 });
  expect(advanceTicks(refreshed.state, 19).events).toEqual([]);
});

test('resolveTargetEffect uses active Shield mitigation and removes auras on a lethal hit', () => {
  const initial = combatEncounter();
  const protectedBoss = applyAura(initial.entities[BOSS.id], CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  initial.entities[BOSS.id] = applyAura(protectedBoss, CLASSES.healer.abilities[2].effect.aura, 'p2', 'copal');
  initial.entities[BOSS.id].health = 35;
  combatPlayer(initial).targetId = BOSS.id;
  freezeCombat(initial);
  const result = combatTick(initial, [combatCast('quickShot')]);
  expect(result.events).toContainEqual({
    type: 'damage', sourceId: 'p3', abilityId: 'quickShot', targetId: BOSS.id, amount: 35, critical: false, tick: 1,
  });
  expect(result.events.at(-1)).toEqual({ type: 'death', entityId: BOSS.id, tick: 1 });
  expect(result.state.entities[BOSS.id]).toMatchObject({ health: 0, auras: [] });
  expect(initial.entities[BOSS.id].auras).toHaveLength(2);
});

test('Shield expiration precedes damage from a cast completing on that tick', () => {
  const initial = combatEncounter();
  initial.entities[BOSS.id] = applyAura(initial.entities[BOSS.id], CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  const last = advanceTicks(initial, 119).state;
  readyCast(last, 'obsidianArrow', 'p3', BOSS.id);
  const result = combatTick(last);
  expect(result.events.at(-1)).toMatchObject({ type: 'damage', amount: 140 });
  expect(result.state.entities[BOSS.id].auras).toEqual([]);
});

test('dead aura holders are cleared at the start of the tick without healing or RNG use', () => {
  const waiting = advanceTicks(castCopal().state, 19).state;
  waiting.entities.p1 = { ...waiting.entities.p1, health: 0 };
  freezeCombat(waiting);
  const result = combatTick(waiting);
  expect(result.state.entities.p1).toMatchObject({ health: 0, auras: [] });
  expect(result.events).toEqual([]);
  expect(result.state.rngState).toBe(waiting.rngState);
  expect(result.state.entities.p3).toBe(waiting.entities.p3);
});

test('multiple Copal pulses replay in stable entity order and preserve frozen input state', () => {
  const initial = castCopal().state;
  initial.entities.p3 = applyAura(initial.entities.p3, CLASSES.healer.abilities[2].effect.aura, 'p2', 'copal');
  const waiting = advanceTicks(initial, 19).state;
  const before = structuredClone(waiting);
  const reversed = { ...waiting, entities: Object.fromEntries(Object.entries(waiting.entities).reverse()) };
  freezeCombat(waiting);
  const result = combatTick(waiting);
  expect(result).toEqual(combatTick(reversed));
  expect(result).toEqual(combatTick(waiting));
  expect(waiting).toEqual(before);
  expect(result.events.map((event) => 'targetId' in event && event.targetId)).toEqual(['p1', 'p3']);
  expect(result.state.rngState).toBe(nextRandom(nextRandom(waiting.rngState).rngState).rngState);
});

test.each([null, 'missing', 'dead'])('aura resolution ignores invalid target %s', (targetId) => {
  const state = combatEncounter();
  state.entities.dead = { ...state.entities.p1, id: 'dead', health: 0 };
  const event: CombatEvent = { type: 'abilityResolved', sourceId: 'p2', abilityId: 'copal', targetId, tick: 1 };
  expect(resolveCombatEffects(state, [event])).toEqual({ state, events: [event] });
});
