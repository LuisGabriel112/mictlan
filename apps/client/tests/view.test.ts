import { expect, test } from 'vitest';
import { BOSS, XOLO } from '@mictlan/core';
import { MoveSender, NO_KEYS_HELD, applyMoveKey, moveVector } from '../src/move-input';
import { PositionHistory } from '../src/interpolation';
import { ENTITY_COLORS, entityColor } from '../src/palette';
import { entityRadius } from '../src/snapshot';
import { screenToWorld, worldToScreen } from '../src/world-view';
import { entity } from './fixtures';

test('world meters project to 32 px with north up and back', () => {
  expect(worldToScreen({ x: 2, y: 3 })).toEqual({ x: 64, y: -96 });
  expect(screenToWorld({ x: 64, y: -96 })).toEqual({ x: 2, y: 3 });
});

test.each([
  [{}, { dx: 0, dy: 0 }],
  [{ up: true }, { dx: 0, dy: 1 }],
  [{ left: true }, { dx: -1, dy: 0 }],
  [{ left: true, right: true }, { dx: 0, dy: 0 }],
  [{ up: true, down: true, right: true }, { dx: 1, dy: 0 }],
])('held keys %j give move %j', (keys, expected) => {
  expect(moveVector({ up: false, down: false, left: false, right: false, ...keys })).toEqual(expected);
});

test('diagonals are normalized to unit length', () => {
  const vector = moveVector({ up: false, down: true, left: false, right: true });
  expect(vector.dx).toBeCloseTo(Math.SQRT1_2, 12);
  expect(vector.dy).toBeCloseTo(-Math.SQRT1_2, 12);
});

test('the move sender only emits when the held direction changes', () => {
  const sender = new MoveSender();
  expect(sender.update({ dx: 0, dy: 0 })).toBeUndefined();
  expect(sender.update({ dx: 0, dy: 1 })).toEqual({ dx: 0, dy: 1 });
  expect(sender.update({ dx: 0, dy: 1 })).toBeUndefined();
  expect(sender.update({ dx: 0, dy: 0 })).toEqual({ dx: 0, dy: 0 });
  expect(sender.update({ dx: 0, dy: 0 })).toBeUndefined();
});

test('positions are interpolated between bracketing snapshots', () => {
  const history = new PositionHistory();
  history.record(0, { a: { x: 0, y: 0 } });
  history.record(100, { a: { x: 10, y: -4 } });
  expect(history.sample(50)).toEqual({ a: { x: 5, y: -2 } });
  expect(history.sample(-20)).toEqual({ a: { x: 0, y: 0 } });
  expect(history.sample(500)).toEqual({ a: { x: 10, y: -4 } });
});

test('an empty history samples nothing', () => {
  expect(new PositionHistory().sample(0)).toEqual({});
});

test('entities that appear later snap to their first known position', () => {
  const history = new PositionHistory();
  history.record(0, { a: { x: 0, y: 0 } });
  history.record(100, { a: { x: 10, y: 0 }, b: { x: 3, y: 3 } });
  expect(history.sample(50)).toEqual({ a: { x: 5, y: 0 }, b: { x: 3, y: 3 } });
});

test('history keeps a bounded number of snapshots', () => {
  const history = new PositionHistory();
  for (let time = 0; time < 1000; time += 10) history.record(time, { a: { x: time, y: 0 } });
  expect(history.size).toBeLessThanOrEqual(PositionHistory.capacity);
  expect(history.sample(985)).toEqual({ a: { x: 985, y: 0 } });
});

test.each([
  [{ type: 'player', classId: 'jaguar' }, ENTITY_COLORS.jaguar],
  [{ type: 'player', classId: 'healer' }, ENTITY_COLORS.healer],
  [{ type: 'player', classId: 'eagle' }, ENTITY_COLORS.eagle],
  [{ type: 'boss', classId: '' }, ENTITY_COLORS.boss],
  [{ type: 'xolo', classId: '' }, ENTITY_COLORS.xolo],
] as const)('%j uses its placeholder color', (kind, color) => {
  expect(entityColor(kind)).toBe(color);
});

test('placeholder colors are orange, green, blue, purple and gray', () => {
  expect(ENTITY_COLORS).toEqual({ jaguar: 0xf28c28, healer: 0x3cb44b, eagle: 0x4363d8, boss: 0x7b2cbf, xolo: 0x9e9e9e });
});

test('body radius comes from core data', () => {
  expect(entityRadius(entity({ id: 'boss', type: 'boss', classId: '' }))).toBe(BOSS.bodyRadiusMeters);
  expect(entityRadius(entity({ id: 'x', type: 'xolo', classId: '' }))).toBe(XOLO.bodyRadiusMeters);
  expect(entityRadius(entity({ id: 'p' }))).toBe(0.5);
});

test.each([
  ['KeyW', 'up'], ['KeyS', 'down'], ['KeyA', 'left'], ['KeyD', 'right'],
] as const)('%s toggles the %s direction', (code, direction) => {
  const pressed = applyMoveKey(NO_KEYS_HELD, code, true);
  expect(pressed).toEqual({ ...NO_KEYS_HELD, [direction]: true });
  expect(applyMoveKey(pressed, code, false)).toEqual(NO_KEYS_HELD);
});

test('keys that do not move keep the same held state', () => {
  expect(applyMoveKey(NO_KEYS_HELD, 'Digit1', true)).toBe(NO_KEYS_HELD);
});
