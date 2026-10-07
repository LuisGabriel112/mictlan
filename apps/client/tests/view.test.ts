import { expect, test } from 'vitest';
import { BOSS, XOLO } from '@mictlan/core';
import { PositionHistory } from '../src/interpolation';
import { ENTITY_COLORS, entityColor } from '../src/palette';
import { entityRadius } from '../src/snapshot';
import { screenToWorld, worldToScreen } from '../src/world-view';
import { entity } from './fixtures';

test('world meters project to 32 px with north up and back', () => {
  expect(worldToScreen({ x: 2, y: 3 })).toEqual({ x: 64, y: -96 });
  expect(screenToWorld({ x: 64, y: -96 })).toEqual({ x: 2, y: 3 });
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
