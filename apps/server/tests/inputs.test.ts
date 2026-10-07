import { expect, test } from 'vitest';
import { INPUT_RULES, InputQueue, parsePlayerInput } from '../src/inputs.js';

test('a move of any length is normalized to unit length', () => {
  expect(parsePlayerInput('p1', 'move', { dx: 3, dy: 4 })).toEqual({ playerId: 'p1', type: 'move', dx: 0.6, dy: 0.8 });
  expect(parsePlayerInput('p1', 'move', { dx: -2, dy: 0 })).toEqual({ playerId: 'p1', type: 'move', dx: -1, dy: 0 });
});

test('a zero move stays at the origin', () => {
  expect(parsePlayerInput('p1', 'move', { dx: 0, dy: 0 })).toEqual({ playerId: 'p1', type: 'move', dx: 0, dy: 0 });
});

test.each([
  { dx: Number.NaN, dy: 0 }, { dx: 0, dy: Number.POSITIVE_INFINITY }, { dx: Number.MAX_VALUE, dy: Number.MAX_VALUE },
  { dx: '1', dy: 0 }, { dx: 1 }, null, [], 5, 'move',
])('an invalid move %j is ignored', (payload) => {
  expect(parsePlayerInput('p1', 'move', payload)).toBeUndefined();
});

test.each(['boss', null])('target %j is accepted', (entityId) => {
  expect(parsePlayerInput('p1', 'target', { entityId })).toEqual({ playerId: 'p1', type: 'target', entityId });
});

test.each([{ entityId: 7 }, { entityId: undefined }, {}, null, 'boss'])('invalid target %j is ignored', (payload) => {
  expect(parsePlayerInput('p1', 'target', payload)).toBeUndefined();
});

test('a known player ability is accepted as cast', () => {
  expect(parsePlayerInput('p1', 'cast', { abilityId: 'obsidianArrow' }))
    .toEqual({ playerId: 'p1', type: 'cast', abilityId: 'obsidianArrow' });
});

test.each([{ abilityId: 'fireball' }, { abilityId: 'flayedStrike' }, { abilityId: 3 }, {}, null])(
  'invalid cast %j is ignored', (payload) => {
    expect(parsePlayerInput('p1', 'cast', payload)).toBeUndefined();
  },
);

test('unknown message types are ignored', () => {
  expect(parsePlayerInput('p1', 'teleport', { dx: 1, dy: 0 })).toBeUndefined();
});

test('the queue caps inputs per player per tick and resets after draining', () => {
  const queue = new InputQueue();
  const move = { playerId: 'p1', type: 'move', dx: 1, dy: 0 } as const;
  for (let index = 0; index < INPUT_RULES.maxInputsPerPlayerPerTick; index += 1) expect(queue.enqueue(move)).toBe(true);
  expect(queue.enqueue(move)).toBe(false);
  expect(queue.enqueue({ ...move, playerId: 'p2' })).toBe(true);
  expect(queue.drain()).toHaveLength(INPUT_RULES.maxInputsPerPlayerPerTick + 1);
  expect(queue.enqueue(move)).toBe(true);
});

test('draining returns inputs in arrival order and empties the queue', () => {
  const queue = new InputQueue();
  const first = { playerId: 'p2', type: 'target', entityId: 'boss' } as const;
  const second = { playerId: 'p1', type: 'cast', abilityId: 'claw' } as const;
  queue.enqueue(first);
  queue.enqueue(second);
  expect(queue.drain()).toEqual([first, second]);
  expect(queue.drain()).toEqual([]);
});
