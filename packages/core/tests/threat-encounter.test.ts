import { expect, test } from 'vitest';
import { BOSS } from '../src/data/boss.js';
import type { Input } from '../src/types.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, muteAutoAttack, readyCast } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';

test('C1: step respects melee and ranged switching thresholds', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 100, p3: 105 } });
  Object.assign(state.entities.p3, { x: 5.5, y: 0 });
  expect(threatEnemy(combatTick(state).state).targetId).toBe('p1');
  threatEnemy(state).threat.p3 = 111;
  expect(threatEnemy(combatTick(state).state).targetId).toBe('p3');
  state.entities.p3.x = 5.5001;
  threatEnemy(state).threat.p3 = 125;
  expect(threatEnemy(combatTick(state).state).targetId).toBe('p1');
  threatEnemy(state).threat.p3 = 131;
  expect(threatEnemy(combatTick(state).state).targetId).toBe('p3');
});

test('C2: Taunt lasts 60 ticks and releases to normal selection exactly three seconds later', () => {
  let state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p3', threat: { p3: 100 } });
  combatPlayer(state, 'p1').targetId = BOSS.id;
  state = combatTick(state, [combatCast('taunt', 'p1')]).state;
  expect(threatEnemy(state)).toMatchObject({ threat: { p1: 110, p3: 100 }, forcedTargetRemainingTicks: 60, targetId: 'p1' });
  state = { ...state, entities: { ...state.entities, [BOSS.id]: { ...threatEnemy(state), threat: { p1: 110, p3: 1000 } } } };
  for (let remaining = 59; remaining > 0; remaining -= 1) {
    state = combatTick(state).state;
    expect(threatEnemy(state)).toMatchObject({ targetId: 'p1', forcedTargetId: 'p1', forcedTargetRemainingTicks: remaining });
  }
  state = combatTick(state).state;
  expect(threatEnemy(state)).toMatchObject({ targetId: 'p3', forcedTargetId: null, forcedTargetRemainingTicks: 0 });
  expect(state.tick).toBe(61);
});

test('C3: direct healing shares only effective healing with living enemies', () => {
  const state = combatEncounter();
  state.entities.second = { ...threatEnemy(state), id: 'second' };
  state.entities.dead = { ...threatEnemy(state), id: 'dead', health: 0 };
  state.entities.p1.health -= 20;
  readyCast(state, 'remedy', 'p2', 'p1');
  const result = combatTick(state);
  expect(result.events.at(-1)).toMatchObject({ type: 'healing', amount: 120, effectiveAmount: 20 });
  expect(threatEnemy(result.state).threat).toEqual({ p2: 5 });
  expect(threatEnemy(result.state, 'second').threat).toEqual({ p2: 5 });
  expect(result.state.entities.dead).toBe(state.entities.dead);
});

test('C4: Roar gives each living enemy in range 125 threat and excludes all others', () => {
  const state = combatEncounter();
  Object.assign(state.entities.p1, { x: 0, y: 0 });
  state.entities.boundary = { ...threatEnemy(state), id: 'boundary', x: 9.5 };
  state.entities.outside = { ...threatEnemy(state), id: 'outside', x: 9.5001 };
  state.entities.dead = { ...threatEnemy(state), id: 'dead', health: 0 };
  const result = combatTick(state, [combatCast('roar', 'p1')]);
  expect(threatEnemy(result.state).threat).toEqual({ p1: 125 });
  expect(threatEnemy(result.state, 'boundary').threat).toEqual({ p1: 125 });
  for (const id of ['outside', 'dead', 'p2', 'p3']) expect(result.state.entities[id]).toBe(state.entities[id]);
});

test('ties select the lower id and a dead player loses the enemy target', () => {
  const state = combatEncounter();
  threatEnemy(state).threat = { p3: 100, p1: 100 };
  const selected = combatTick(state).state;
  expect(threatEnemy(selected).targetId).toBe('p1');
  const dead = { ...selected, entities: { ...selected.entities, p1: { ...selected.entities.p1, health: 0 } } };
  expect(threatEnemy(combatTick(dead).state).targetId).toBe('p3');
});

test('damage threat uses mitigated final damage and remains local to the target', () => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state, 'p1'), { x: 0, y: 0, targetId: BOSS.id, autoAttackRemainingTicks: 40 });
  threatEnemy(state).armorBps = 3000;
  state.entities.other = { ...threatEnemy(state), id: 'other' };
  const result = combatTick(state, [combatCast('claw', 'p1')]);
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'damage', abilityId: 'claw', amount: 28 }));
  expect(threatEnemy(result.state).threat).toEqual({ p1: 84 });
  expect(result.state.entities.other).toBe(state.entities.other);
});

test('healing sees enemy deaths from earlier cast resolutions in the same tick', () => {
  const state = combatEncounter();
  state.entities.p1 = { ...combatPlayer(state, 'p1'), classId: 'eagle', health: 100 };
  state.entities.victim = { ...threatEnemy(state), id: 'victim', health: 140 };
  readyCast(state, 'obsidianArrow', 'p1', 'victim');
  readyCast(state, 'remedy', 'p2', 'p1');
  const result = combatTick(state);
  expect(threatEnemy(result.state).threat).toEqual({ p2: 60 });
  expect(threatEnemy(result.state, 'victim').threat).toEqual({ p1: 140 });
});

test('area healing accumulates per healed ally and ignores full-health allies', () => {
  const state = combatEncounter();
  state.entities.p1.health -= 20;
  state.entities.p2.health -= 50;
  expect(threatEnemy(combatTick(state, [combatCast('offering', 'p2')]).state).threat).toEqual({ p2: 35 });
});

test('target selection runs only after all players instead of applying intermediate hysteresis', () => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state, 'p1'), { x: 0, y: 0, targetId: BOSS.id, autoAttackRemainingTicks: 40 });
  combatPlayer(state).targetId = BOSS.id;
  muteAutoAttack(state, 'p3');
  threatEnemy(state).threat = { p3: 51 };
  const inputs: Input[] = [combatCast('quickShot'), combatCast('claw', 'p1')];
  const result = combatTick(state, inputs);
  expect(threatEnemy(result.state)).toMatchObject({ threat: { p1: 120, p3: 121 }, targetId: 'p3' });
  expect(result).toEqual(combatTick(state, [...inputs].reverse()));
});

test('selection uses the challenger position after the last move in the tick', () => {
  const state = combatEncounter();
  Object.assign(threatEnemy(state), { targetId: 'p1', threat: { p1: 100, p3: 111 } });
  Object.assign(state.entities.p3, { x: 5.8, y: 0 });
  const result = combatTick(state, [{ type: 'move', playerId: 'p3', dx: -1, dy: 0 }]);
  expect(threatEnemy(result.state).targetId).toBe('p3');
});

test('dead sources cannot create damage, flat, healing or forced threat through step', () => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state, 'p1'), { x: 0, y: 0, health: 0, targetId: BOSS.id });
  state.entities.p2.health = 0;
  for (const abilityId of ['claw', 'roar', 'taunt'] as const) {
    expect(combatTick(state, [combatCast(abilityId, 'p1')]).state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
  }
  expect(combatTick(state, [combatCast('offering', 'p2')]).state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
});

test('frozen state is deterministic and unchanged entities are reused when damage pulls the boss', () => {
  const state = combatEncounter();
  combatPlayer(state).targetId = BOSS.id;
  muteAutoAttack(state, 'p3');
  const original = structuredClone(state);
  const inputs = [combatCast('quickShot')];
  freezeCombat(state);
  freezeCombat(inputs);
  const result = combatTick(state, inputs);
  expect(state).toEqual(original);
  expect(result).toEqual(combatTick(state, inputs));
  expect(threatEnemy(result.state)).toMatchObject({ threat: { p3: 70 }, targetId: 'p3', autoAttackRemainingTicks: 0 });
  expect(Math.hypot(result.state.entities.boss.x, result.state.entities.boss.y)).toBeCloseTo(0.25, 12);
  expect(result.state).toMatchObject({ bossActive: true, elapsedTicks: 1, phaseElapsedTicks: 1 });
  for (const id of ['p1', 'p2']) expect(result.state.entities[id]).toBe(state.entities[id]);
});
