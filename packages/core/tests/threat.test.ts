import { expect, test } from 'vitest';
import { BOSS } from '../src/data/boss.js';
import { THREAT_RULES } from '../src/data/threat.js';
import { advanceThreatTimers, applyThreatEvent, updateEnemyTargets } from '../src/threat.js';
import { combatEncounter, combatPlayer, freezeCombat } from './combat-fixtures.js';
import { threatDamage, threatEnemy, threatHealing, threatTaunt } from './threat-fixtures.js';

test('threat definitions match SPEC basis points', () => {
  expect(THREAT_RULES).toEqual({ healingMultiplierBps: 5000, meleeSwitchBps: 11000, rangedSwitchBps: 13000 });
});

test.each([
  { sourceId: 'p1', abilityId: 'claw' as const, amount: 28, expected: 89 },
  { sourceId: 'p2', abilityId: 'autoAttack' as const, amount: 21, expected: 26 },
  { sourceId: 'p3', abilityId: 'quickShot' as const, amount: 70, expected: 75 },
])('final damage uses $sourceId class multiplier only on the hit enemy', ({ sourceId, abilityId, amount, expected }) => {
  const state = combatEncounter();
  threatEnemy(state).threat = { [sourceId]: 5 };
  state.entities.other = { ...threatEnemy(state), id: 'other', threat: {} };
  freezeCombat(state);
  const result = applyThreatEvent(state, threatDamage({ sourceId, abilityId, amount }));
  expect(threatEnemy(result).threat).toEqual({ [sourceId]: expected });
  expect(threatEnemy(state).threat).toEqual({ [sourceId]: 5 });
  for (const id of ['other', 'p1', 'p2', 'p3']) expect(result.entities[id]).toBe(state.entities[id]);
});

test('damage threat includes killing damage rather than remaining health', () => {
  const state = combatEncounter();
  threatEnemy(state).health = -30;
  expect(threatEnemy(applyThreatEvent(state, threatDamage())).threat).toEqual({ p1: 120 });
});

test('C4: flat Roar threat is added after the class multiplier', () => {
  const result = applyThreatEvent(combatEncounter(), threatDamage({ abilityId: 'roar', amount: 25 }));
  expect(threatEnemy(result).threat).toEqual({ p1: 125 });
});

test('C3: effective healing is divided among living enemies without rounding away fractions', () => {
  const state = combatEncounter();
  state.entities.second = { ...threatEnemy(state), id: 'second', threat: { p2: 2 } };
  state.entities.third = { ...threatEnemy(state), id: 'third', threat: {} };
  state.entities.dead = { ...threatEnemy(state), id: 'dead', health: 0 };
  freezeCombat(state);
  const result = applyThreatEvent(state, threatHealing({ effectiveAmount: 1 }));
  expect(threatEnemy(result).threat.p2).toBe(0.5 / 3);
  expect(threatEnemy(result, 'second').threat.p2).toBe(2 + 0.5 / 3);
  expect(threatEnemy(result, 'third').threat.p2).toBe(0.5 / 3);
  for (const id of ['dead', 'p1', 'p2', 'p3']) expect(result.entities[id]).toBe(state.entities[id]);
});

test('healing threat has no class multiplier or distance restriction', () => {
  const state = combatEncounter();
  threatEnemy(state).x = 100;
  expect(threatEnemy(applyThreatEvent(state, threatHealing({ sourceId: 'p1' }))).threat).toEqual({ p1: 10 });
});

test('overhealing and zero damage retain the original state and threat table', () => {
  const state = combatEncounter();
  expect(applyThreatEvent(state, threatHealing({ effectiveAmount: 0 }))).toBe(state);
  expect(applyThreatEvent(state, threatDamage({ amount: 0 }))).toBe(state);
});

test('healing without living enemies leaves the state unchanged', () => {
  const state = combatEncounter();
  threatEnemy(state).health = 0;
  expect(applyThreatEvent(state, threatHealing())).toBe(state);
});

test.each(['missing', BOSS.id, 'p1'])('unavailable source %s generates no damage, healing or taunt threat', (sourceId) => {
  const state = combatEncounter();
  state.entities.p1.health = 0;
  expect(applyThreatEvent(state, threatDamage({ sourceId }))).toBe(state);
  expect(applyThreatEvent(state, threatHealing({ sourceId }))).toBe(state);
  expect(applyThreatEvent(state, { ...threatTaunt(), sourceId })).toBe(state);
});

test.each(['missing', 'p1'])('damage to %s cannot create an enemy threat table', (targetId) => {
  const state = combatEncounter();
  expect(applyThreatEvent(state, threatDamage({ targetId }))).toBe(state);
});

test.each([null, 'missing', 'p1', 'dead'])('taunt ignores invalid enemy %s', (targetId) => {
  const state = combatEncounter();
  state.entities.dead = { ...threatEnemy(state), id: 'dead', health: 0 };
  expect(applyThreatEvent(state, threatTaunt(targetId))).toBe(state);
});

test('unrelated events and resolved abilities cannot produce threat', () => {
  const state = combatEncounter();
  expect(applyThreatEvent(state, { type: 'death', entityId: 'p3', tick: 1 })).toBe(state);
  expect(applyThreatEvent(state, { ...threatTaunt(), abilityId: 'claw' })).toBe(state);
  expect(applyThreatEvent(state, { ...threatTaunt(), abilityId: 'remedy' })).toBe(state);
  expect(applyThreatEvent(state, { ...threatTaunt(), type: 'castFinished' })).toBe(state);
});

test.each<{ threat: Record<string, number>; expected: number }>([
  { threat: { p1: 20, p3: 100 }, expected: 110 },
  { threat: { p1: 200, p3: 100 }, expected: 220 },
  { threat: { p3: 1 }, expected: 1.1 },
  { threat: {}, expected: 0 },
])('C2: taunt uses the maximum of the whole table $threat', ({ threat, expected }) => {
  const state = combatEncounter();
  threatEnemy(state).threat = threat;
  freezeCombat(state);
  const result = applyThreatEvent(state, threatTaunt());
  expect(threatEnemy(result)).toMatchObject({
    threat: { ...threat, p1: expected }, targetId: 'p1', forcedTargetId: 'p1', forcedTargetRemainingTicks: 60,
  });
  expect(threatEnemy(state).threat).toEqual(threat);
  expect(result.entities.p1).toBe(state.entities.p1);
});

test('taunt maximum includes existing dead-player entries but those players cannot be selected', () => {
  const state = combatEncounter();
  state.entities.p3.health = 0;
  threatEnemy(state).threat = { p3: 100 };
  expect(threatEnemy(applyThreatEvent(state, threatTaunt())).threat).toEqual({ p1: 110, p3: 100 });
});

test.each([
  { x: 5.5, amount: 105, targetId: 'p1' }, { x: 5.5, amount: 110, targetId: 'p1' },
  { x: 5.5, amount: 111, targetId: 'p3' }, { x: 5.5001, amount: 125, targetId: 'p1' },
  { x: 5.5001, amount: 130, targetId: 'p1' }, { x: 5.5001, amount: 131, targetId: 'p3' },
])('C1: $amount percent at center distance $x selects $targetId', ({ x, amount, targetId }) => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 100, p3: amount } });
  Object.assign(state.entities.p3, { x, y: 0 });
  const result = updateEnemyTargets(state);
  expect(threatEnemy(result).targetId).toBe(targetId);
  expect(threatEnemy(result).threat).toBe(threatEnemy(state).threat);
  if (targetId === 'p1') expect(result).toBe(state);
});

test.each([{ x: 5.5, amount: 1.1 }, { x: 5.5001, amount: 1.3 }])(
  'basis point comparison keeps exact fractional threshold $amount', ({ x, amount }) => {
    const state = combatEncounter();
    Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 1, p3: amount } });
    Object.assign(state.entities.p3, { x, y: 0 });
    expect(updateEnemyTargets(state)).toBe(state);
  },
);

test('target distance uses both centers and the enemy radius, not the player radius', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { x: 3, y: 4, bodyRadiusMeters: 1, targetId: 'p1', threat: { p1: 10, p3: 12 } });
  Object.assign(state.entities.p3, { x: 6, y: 8 });
  expect(threatEnemy(updateEnemyTargets(state)).targetId).toBe('p3');
});

test('equal maximum threat selects the lower string id independently of table insertion', () => {
  const state = combatEncounter();
  state.entities.A = { ...combatPlayer(state, 'p1'), id: 'A' };
  state.entities.a = { ...combatPlayer(state, 'p3'), id: 'a' };
  threatEnemy(state).threat = { a: 100, A: 100, p2: 1 };
  const reversed = { ...state, entities: { ...state.entities, [BOSS.id]: { ...threatEnemy(state), threat: { A: 100, a: 100 } } } };
  expect(threatEnemy(updateEnemyTargets(state)).targetId).toBe('A');
  expect(threatEnemy(updateEnemyTargets(reversed)).targetId).toBe('A');
});

test('a living current target retains an equal-threat tie due to hysteresis', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p3', threat: { p1: 100, p3: 100 } });
  expect(updateEnemyTargets(state)).toBe(state);
});

test.each([null, 'missing', 'p1', BOSS.id])('invalid current target %s selects the living maximum directly', (targetId) => {
  const state = combatEncounter();
  state.entities.p1.health = 0;
  Object.assign(threatEnemy(state), { targetId, threat: { p1: 1000, missing: 2000, [BOSS.id]: 3000, p3: 1, p2: 2 } });
  expect(threatEnemy(updateEnemyTargets(state)).targetId).toBe('p2');
});

test('dead player loses even a forced target immediately', () => {
  const state = applyThreatEvent(combatEncounter(), threatTaunt());
  state.entities.p1 = { ...state.entities.p1, health: 0 };
  threatEnemy(state).threat.p3 = 1;
  expect(threatEnemy(updateEnemyTargets(state))).toMatchObject({ targetId: 'p3', forcedTargetId: null, forcedTargetRemainingTicks: 0 });
});

test('without living threat entries a dead current target becomes null', () => {
  const state = combatEncounter();
  state.entities.p1.health = 0;
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 100 } });
  expect(threatEnemy(updateEnemyTargets(state)).targetId).toBeNull();
});

test('empty tables and dead enemies keep their references', () => {
  const state = combatEncounter();
  state.entities.dead = { ...threatEnemy(state), id: 'dead', health: 0, targetId: 'p3', threat: { p1: 10 } };
  expect(updateEnemyTargets(state)).toBe(state);
  expect(advanceThreatTimers(state)).toBe(state);
});

test('a living current target with no challenger retains its reference', () => {
  const state = combatEncounter();
  threatEnemy(state).targetId = 'p1';
  expect(updateEnemyTargets(state)).toBe(state);
});

test('selection clears stale force fields even when the normal target stays the same', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 10 }, forcedTargetId: 'p1' });
  expect(threatEnemy(updateEnemyTargets(state))).toMatchObject({ targetId: 'p1', forcedTargetId: null, forcedTargetRemainingTicks: 0 });
  threatEnemy(state).forcedTargetId = null;
  threatEnemy(state).forcedTargetRemainingTicks = 10;
  expect(threatEnemy(updateEnemyTargets(state)).forcedTargetRemainingTicks).toBe(0);
});

test('enemy fixture rejects missing entities and players', () => {
  const state = combatEncounter();
  expect(() => threatEnemy(state, 'missing')).toThrow('Missing enemy: missing');
  expect(() => threatEnemy(state, 'p1')).toThrow('Missing enemy: p1');
});

test('a zero-threat living current target switches when a challenger gains threat', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p3: 1 } });
  expect(threatEnemy(updateEnemyTargets(state)).targetId).toBe('p3');
});

test('active force overrides maximum threat without reevaluation decrementing its timer', () => {
  const state = applyThreatEvent(combatEncounter(), threatTaunt());
  threatEnemy(state).threat.p3 = 1000;
  freezeCombat(state);
  expect(updateEnemyTargets(state)).toBe(state);
  const advanced = advanceThreatTimers(state);
  expect(threatEnemy(advanced)).toMatchObject({ targetId: 'p1', forcedTargetId: 'p1', forcedTargetRemainingTicks: 59 });
  expect(threatEnemy(advanced).threat).toBe(threatEnemy(state).threat);
});

test('expired force clears its fields while retaining the tank as current target for normal selection', () => {
  const state = applyThreatEvent(combatEncounter(), threatTaunt());
  Object.assign(threatEnemy(state), { forcedTargetRemainingTicks: 1, threat: { p1: 100, p3: 125 } });
  const advanced = advanceThreatTimers(state);
  expect(threatEnemy(advanced)).toMatchObject({ targetId: 'p1', forcedTargetId: null, forcedTargetRemainingTicks: 0 });
  expect(updateEnemyTargets(advanced)).toBe(advanced);
  expect(advanceThreatTimers(advanced)).toBe(advanced);
});
