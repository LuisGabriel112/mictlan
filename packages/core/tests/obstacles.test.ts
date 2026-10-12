import { expect, test } from 'vitest';
import { COMBAT_RULES } from '../src/data/classes.js';
import { blockedByObstacle, resolveObstacles } from '../src/mechanics/obstacles.js';

test('defines four fixed obstacles at the specified radius and angles', () => {
  expect(COMBAT_RULES.arena.obstacles).toHaveLength(4);
  expect(COMBAT_RULES.arena.obstacles.map(({ x, y, radiusMeters }) => [x, y, radiusMeters]))
    .toEqual([[Math.SQRT1_2 * 10, Math.SQRT1_2 * 10, 1.2], [-Math.SQRT1_2 * 10, Math.SQRT1_2 * 10, 1.2],
      [-Math.SQRT1_2 * 10, -Math.SQRT1_2 * 10, 1.2], [Math.SQRT1_2 * 10, -Math.SQRT1_2 * 10, 1.2]]);
});

test('detects overlap and resolves collision at the combined radii', () => {
  const center = COMBAT_RULES.arena.obstacles[0];
  expect(blockedByObstacle(center, center, 0.5)).toBe(true);
  const resolved = resolveObstacles({ x: center.x - 3, y: center.y }, { x: center.x, y: center.y }, 0.5);
  expect(Math.hypot(resolved.x - center.x, resolved.y - center.y)).toBeGreaterThanOrEqual(1.7);
});

test('slides along the obstacle while preserving unobstructed travel', () => {
  const center = COMBAT_RULES.arena.obstacles[0];
  const resolved = resolveObstacles({ x: center.x - 3, y: center.y - 2 }, { x: center.x, y: center.y + 2 }, 0.5);
  expect(Math.hypot(resolved.x - center.x, resolved.y - center.y)).toBeGreaterThanOrEqual(1.7);
  expect(resolved.y).toBeGreaterThan(center.y);
});
