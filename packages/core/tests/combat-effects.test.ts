import { expect, test } from 'vitest';
import { resolveCombatEffects } from '../src/combat-effects.js';
import { BOSS, nextRandom } from '../src/index.js';
import type { CombatEvent, Input, PlayerAbilityId } from '../src/index.js';
import { arrowEncounter, combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';

test('C2: Arrow with critChance 1 deals 210 using rngState', () => {
  const state = arrowEncounter(1);
  const result = combatTick(state);
  expect(result.state.entities[BOSS.id].health).toBe(BOSS.maxHealthByPlayerCount[3] - 210);
  expect(result.state.rngState).toBe(nextRandom(state.rngState).rngState);
  expect(result.events.at(-1)).toEqual({
    type: 'damage', tick: 1, sourceId: 'p3', abilityId: 'obsidianArrow', targetId: BOSS.id, amount: 210, critical: true,
  });
});

test.each([
  { abilityId: 'claw', playerId: 'p1', amount: 40 },
  { abilityId: 'quickShot', playerId: 'p3', amount: 70 },
] satisfies { abilityId: PlayerAbilityId; playerId: string; amount: number }[])(
  '$abilityId applies configured direct damage with attribution', ({ abilityId, playerId, amount }) => {
    const state = combatEncounter();
    Object.assign(combatPlayer(state, playerId), { x: 0, y: 0, targetId: BOSS.id });
    state.entities[playerId].autoAttackRemainingTicks = 40;
    const result = combatTick(state, [combatCast(abilityId, playerId)]);
    expect(result.state.entities[BOSS.id].health).toBe(BOSS.maxHealthByPlayerCount[3] - amount);
    expect(result.events).toContainEqual({
      type: 'damage', sourceId: playerId, abilityId, targetId: BOSS.id, amount, critical: false, tick: 1,
    });
  },
);

test.each([
  { abilityId: 'remedy', amount: 120 }, { abilityId: 'greatRemedy', amount: 350 },
] satisfies { abilityId: PlayerAbilityId; amount: number }[])(
  '$abilityId heals at resolution and preserves the injured target through its timer phase', ({ abilityId, amount }) => {
    const state = combatEncounter();
    state.entities.p3.health = 100;
    readyCast(state, abilityId, 'p2', 'p3');
    const result = combatTick(state);
    expect(result.state.entities.p3.health).toBe(100 + amount);
    expect(result.events.at(-1)).toEqual({
      type: 'healing', tick: 1, sourceId: 'p2', abilityId, targetId: 'p3', amount, effectiveAmount: amount, critical: false,
    });
  },
);

test('C3: Remedy caps health and emits effective healing without overheal', () => {
  const state = combatEncounter();
  state.entities.p1.health = 1180;
  readyCast(state, 'remedy', 'p2', 'p1');
  const result = combatTick(state);
  expect(result.state.entities.p1.health).toBe(1200);
  expect(result.events.at(-1)).toMatchObject({ type: 'healing', amount: 120, effectiveAmount: 20 });
});

test('player healing can critically heal with the same seeded RNG', () => {
  const state = combatEncounter(1);
  state.entities.p2.health = 100;
  readyCast(state, 'remedy', 'p2', 'p2');
  const result = combatTick(state);
  expect(result.state.entities.p2.health).toBe(280);
  expect(result.events.at(-1)).toMatchObject({ type: 'healing', amount: 180, effectiveAmount: 180, critical: true });
  expect(result.state.rngState).toBe(nextRandom(state.rngState).rngState);
});

test('Roar includes body-adjusted boundary enemies, excludes dead and distant enemies and allies', () => {
  const state = combatEncounter();
  Object.assign(state.entities.p1, { x: 0, y: 0 });
  state.entities[BOSS.id].x = 9.5;
  state.entities.outside = { ...state.entities[BOSS.id], id: 'outside', x: 9.5001 };
  state.entities.dead = { ...state.entities[BOSS.id], id: 'dead', health: 0 };
  const boss = state.entities[BOSS.id];
  if (boss.type === 'player') throw new Error('Expected boss');
  state.entities.add = { ...boss, id: 'add', type: 'xolo', x: 0, health: 100 };
  const result = combatTick(state, [combatCast('roar', 'p1')]);
  const roarHits = result.events.filter((event) => event.type === 'damage').filter((hit) => hit.abilityId === 'roar');
  expect(roarHits.map((hit) => [hit.targetId, hit.amount])).toEqual([
    ['add', 25], [BOSS.id, 25],
  ]);
  for (const id of ['outside', 'dead', 'p2', 'p3']) expect(result.state.entities[id]).toBe(state.entities[id]);
  expect(result.state.entities[BOSS.id]).toMatchObject({ threat: { p1: 125 }, health: BOSS.maxHealthByPlayerCount[3] - 25 });
});

test('Offering includes self and living boundary allies but excludes enemies, dead and distant allies', () => {
  const state = combatEncounter();
  Object.assign(state.entities.p2, { x: -15, y: 0, health: 100 });
  Object.assign(state.entities.p1, { x: 15.5, y: 0, health: 100 });
  Object.assign(state.entities.p3, { x: 15.5001, y: 0, health: 100 });
  state.entities.dead = { ...state.entities.p1, id: 'dead', health: 0 };
  const result = combatTick(state, [combatCast('offering', 'p2')]);
  expect(result.events.filter((event) => event.type === 'healing').map((heal) => [heal.targetId, heal.effectiveAmount])).toEqual([
    ['p1', 150], ['p2', 150],
  ]);
  expect(result.state.entities.p2).toMatchObject({ health: 250, mana: 850 });
  for (const id of ['dead', 'p3']) expect(result.state.entities[id]).toBe(state.entities[id]);
  expect(result.state.entities[BOSS.id]).toMatchObject({ health: BOSS.maxHealthByPlayerCount[3], threat: { p2: 150 } });
});

test.each([0, -1])('C4: a player at %s health ignores targeting, movement and casting', (health) => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state), { health, mana: 0, gcdRemainingTicks: 2 });
  const result = combatTick(state, [
    { type: 'target', playerId: 'p3', entityId: BOSS.id },
    { type: 'move', playerId: 'p3', dx: 1, dy: 0 }, combatCast('flight'),
  ]);
  expect(result.state.entities.p3).toBe(state.entities.p3);
  expect(result.events).toEqual([{ type: 'abilityRejected', tick: 1, sourceId: 'p3', abilityId: 'flight', reason: 'dead' }]);
  combatPlayer(state, 'p2').targetId = 'p3';
  expect(combatTick(state, [combatCast('remedy', 'p2')]).events.at(-1)).toMatchObject({ reason: 'invalid_target' });
});

test('death at exactly zero invalidates a later instant action in the same tick', () => {
  const state = combatEncounter();
  // Kill an add so the boss stays alive and the encounter does not end.
  state.entities.add = { ...threatEnemy(state), id: 'add', type: 'xolo', health: 40 };
  Object.assign(combatPlayer(state, 'p1'), { x: 0, y: 0, targetId: 'add' });
  combatPlayer(state).targetId = 'add';
  const result = combatTick(state, [combatCast('quickShot'), combatCast('claw', 'p1')]);
  expect(result.events.map(({ type }) => type)).toEqual(['abilityResolved', 'damage', 'death', 'abilityRejected']);
  expect(result.events.at(-1)).toMatchObject({ reason: 'invalid_target' });
  expect(result.state.entities.add.health).toBe(0);
  expect(combatPlayer(result.state).cooldowns.quickShot).toBeUndefined();
});

test('an earlier completed cast kills the target before a later cast resolves', () => {
  const state = combatEncounter();
  state.entities.add = { ...threatEnemy(state), id: 'add', type: 'xolo', health: 140 };
  state.entities.p1 = { ...combatPlayer(state, 'p1'), classId: 'eagle' };
  readyCast(state, 'obsidianArrow', 'p1', 'add');
  readyCast(state, 'obsidianArrow', 'p3', 'add');
  const result = combatTick(state);
  expect(result.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'damage', 'death', 'castCancelled']);
  expect(result.events.at(-1)).toMatchObject({ sourceId: 'p3', reason: 'invalid_target' });
  expect(result.state.rngState).toBe(nextRandom(state.rngState).rngState);
});

test('combat preserves frozen state and references and replays deterministically', () => {
  const state = arrowEncounter();
  const before = structuredClone(state);
  freezeCombat(state);
  const result = combatTick(state);
  expect(result).toEqual(combatTick(state));
  expect(state).toEqual(before);
  expect(result.state.entities.p1).toBe(state.entities.p1);
  expect(result.state.entities.p2).toBe(state.entities.p2);
  expect(result.state.entities[BOSS.id].auras).toBe(state.entities[BOSS.id].auras);
});

test('area resolution uses stable id order independently of entity insertion and input order', () => {
  const state = combatEncounter();
  const reordered = { ...state, entities: Object.fromEntries(Object.entries(state.entities).reverse()) };
  const inputs: Input[] = [combatCast('offering', 'p2'), { type: 'move', playerId: 'p1', dx: 0, dy: 0 }];
  expect(combatTick(state, inputs)).toEqual(combatTick(reordered, [...inputs].reverse()));
  let expectedRng = state.rngState;
  for (let index = 0; index < 3; index += 1) expectedRng = nextRandom(expectedRng).rngState;
  expect(combatTick(state, inputs).state.rngState).toBe(expectedRng);
});

test.each(['warCry'] satisfies PlayerAbilityId[])(
  '%s without an interruptible cast leaves the target and RNG unchanged', (abilityId) => {
    const state = combatEncounter();
    const playerId = 'p3';
    combatPlayer(state, playerId).targetId = BOSS.id;
    const result = combatTick(state, [combatCast(abilityId, playerId)]);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ type: 'abilityRejected', reason: 'not_casting' });
    expect(result.state.rngState).toBe(state.rngState);
    expect(result.state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
    expect(result.state.entities.p1.auras).toEqual([]);
  },
);

test.each(['missing', BOSS.id, 'p1'])('effects ignore unavailable direct abilities from %s', (sourceId) => {
  const state = combatEncounter();
  const event: CombatEvent = { type: 'abilityResolved', tick: 1, sourceId, abilityId: 'obsidianArrow', targetId: BOSS.id };
  const result = resolveCombatEffects(state, [event]);
  expect(result).toEqual({ state, events: [event] });
  expect(result.state).toBe(state);
});

test.each([null, 'missing', 'dead'])('effects ignore nonexistent or dead direct target %s', (targetId) => {
  const state = combatEncounter();
  state.entities.dead = { ...state.entities[BOSS.id], id: 'dead', health: 0 };
  const event: CombatEvent = { type: 'abilityResolved', tick: 1, sourceId: 'p3', abilityId: 'quickShot', targetId };
  expect(resolveCombatEffects(state, [event])).toEqual({ state, events: [event] });
});

test('a dead source cannot resolve direct effects and a dead unit cannot be selected', () => {
  const state = combatEncounter();
  state.entities.p3.health = 0;
  const event: CombatEvent = { type: 'abilityResolved', tick: 1, sourceId: 'p3', abilityId: 'quickShot', targetId: BOSS.id };
  expect(resolveCombatEffects(state, [event])).toEqual({ state, events: [event] });
  const result = combatTick(state, [{ type: 'target', playerId: 'p2', entityId: 'p3' }]);
  expect(combatPlayer(result.state, 'p2').targetId).toBeNull();
});
