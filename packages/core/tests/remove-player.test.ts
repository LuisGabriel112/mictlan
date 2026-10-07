import { expect, test } from 'vitest';
import { CLASSES, removePlayer } from '../src/index.js';
import { applyAura } from '../src/auras.js';
import { combatEncounter, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';

test('C4: removePlayer returns a dead player without mutating the frozen input', () => {
  const original = combatEncounter();
  readyCast(original, 'remedy', 'p2', 'p1');
  original.tick = 17;
  original.entities.p2 = applyAura(original.entities.p2, CLASSES.healer.abilities[2].effect.aura, 'p2', 'copal');
  const snapshot = structuredClone(original);
  freezeCombat(original);
  const result = removePlayer(original, 'p2');
  expect(result.state).not.toBe(original);
  expect(result.state.entities.p2).toEqual({ ...original.entities.p2, health: 0, cast: null, auras: [] });
  expect(result.state).toEqual({ ...original, entities: { ...original.entities, p2: result.state.entities.p2 } });
  expect(result.state.entities.p1).toBe(original.entities.p1);
  expect(result.state.entities.boss).toBe(original.entities.boss);
  expect(result.events).toEqual([{ type: 'death', entityId: 'p2', sourceId: 'p2', abilityId: 'disconnect', tick: 17 }]);
  expect(original).toEqual(snapshot);
});

test('C4: repeated removal preserves the dead state and emits no second death', () => {
  const removed = removePlayer(combatEncounter(), 'p3');
  freezeCombat(removed.state);
  const repeated = removePlayer(removed.state, 'p3');
  expect(repeated.state).toBe(removed.state);
  expect(repeated.events).toEqual([]);
});

test.each(['missing', 'boss', '__proto__'])('C4: removal of %s is a no-op', (id) => {
  const original = combatEncounter();
  freezeCombat(original);
  const result = removePlayer(original, id);
  expect(result.state).toBe(original);
  expect(result.events).toEqual([]);
});

test.each([0, -12])('C4: a player already at %s health is unchanged', (health) => {
  const original = combatEncounter();
  original.entities.p3 = { ...original.entities.p3, health };
  freezeCombat(original);
  expect(removePlayer(original, 'p3')).toEqual({ state: original, events: [] });
});

test('removing all players leaves outcome evaluation to the next step', () => {
  let encounter = combatEncounter();
  for (const { id } of encounter.config.players) encounter = removePlayer(encounter, id).state;
  expect(encounter.status).toBe('combat');
  const ended = combatTick(encounter);
  expect(ended.state.status).toBe('defeat');
  expect(ended.events).toEqual([{ type: 'encounterEnded', outcome: 'defeat', tick: 1 }]);
  expect(combatTick(ended.state).events).toEqual([]);
});
