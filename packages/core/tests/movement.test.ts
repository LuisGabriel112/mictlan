import { expect, test } from 'vitest';
import { clampToWall, displace, normalize } from '../src/movement.js';

test('normalize handles zero and unnormalized input', () => {
  expect(normalize(0, 0)).toEqual({ x: 0, y: 0 });
  expect(normalize(3, 4)).toEqual({ x: 0.6, y: 0.8 });
});

test('clampToWall preserves in-bounds positions by reference and hits axis boundaries exactly', () => {
  const inside = { x: 1, y: 1 };
  expect(clampToWall(inside)).toBe(inside);
  expect(clampToWall({ x: 28, y: 0 })).toEqual({ x: 20, y: 0 });
  expect(clampToWall({ x: 0, y: -28 })).toEqual({ x: 0, y: -20 });
});

test.each([{ x: 30, y: 31 }, { x: 29, y: 37 }, { x: -27, y: -18 }])(
  'diagonal wall projection stays inside at $x,$y', (position) => {
    const clamped = clampToWall(position);
    expect(Math.hypot(clamped.x, clamped.y)).toBeLessThanOrEqual(20);
    expect(Math.hypot(clamped.x, clamped.y)).toBeCloseTo(20, 12);
    expect(clamped.x / clamped.y).toBeCloseTo(position.x / position.y, 12);
  },
);

test('displace adds direction times distance before wall clipping without mutation', () => {
  const position = Object.freeze({ x: 2, y: 1 });
  expect(displace(position, { x: 0.6, y: 0.8 }, 8)).toEqual({ x: 6.8, y: 7.4 });
  expect(displace(position, { x: 1, y: 0 }, 100).x).toBeLessThan(20);
  expect(position).toEqual({ x: 2, y: 1 });
});
