import { expect, test } from 'vitest';
import { isoCamera, projectToScreen } from '../src/world-3d/iso-camera';
import { UNIT_HEIGHTS } from '../src/world-3d/arena-world';
import { unitAtPixel } from '../src/world-3d/unit-pick';
import { entity, room } from './fixtures';

const camera = isoCamera(1280, 720);
const project = (world: { x: number; y: number }, height = 0) => projectToScreen(camera, world, height);
const snapshot = room([entity({ id: 'p1', x: 5, y: 0 }), entity({ id: 'boss', type: 'boss', classId: '', x: -6, y: 2 })]);

test('clicking the body above the feet selects the unit, not only its ground circle', () => {
  expect(unitAtPixel(snapshot, {}, project({ x: 5, y: 0 }, UNIT_HEIGHTS.player * 0.8), project)).toBe('p1');
  expect(unitAtPixel(snapshot, {}, project({ x: -6, y: 2 }, UNIT_HEIGHTS.boss * 0.9), project)).toBe('boss');
  expect(unitAtPixel(snapshot, {}, project({ x: 5, y: 0 }), project)).toBe('p1');
});

test('empty ground selects nothing', () => {
  expect(unitAtPixel(snapshot, {}, project({ x: 0, y: -10 }), project)).toBeUndefined();
});

test('interpolated positions win over the raw snapshot position', () => {
  const pixel = project({ x: 1, y: 1 }, 0.8);
  expect(unitAtPixel(snapshot, { p1: { x: 1, y: 1 } }, pixel, project)).toBe('p1');
  expect(unitAtPixel(snapshot, {}, pixel, project)).toBeUndefined();
});

test('overlapping units resolve to the closest body axis', () => {
  const crowded = room([entity({ id: 'a', x: 0, y: 0 }), entity({ id: 'b', x: 0.6, y: 0 })]);
  expect(unitAtPixel(crowded, {}, project({ x: 0.5, y: 0 }, 0.5), project)).toBe('b');
  expect(unitAtPixel(crowded, {}, project({ x: 0.1, y: 0 }, 0.5), project)).toBe('a');
});
