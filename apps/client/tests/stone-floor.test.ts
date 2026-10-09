import { expect, test } from 'vitest';
import { STONE_FLOOR, stoneFloorGeometry, stoneTone } from '../src/world-3d/stone-floor';

test('stone tones are deterministic and stay inside the dark stone range', () => {
  const tones = Array.from({ length: 200 }, (_, index) => stoneTone(index % 9, index));
  expect(tones).toEqual(Array.from({ length: 200 }, (_, index) => stoneTone(index % 9, index)));
  for (const tone of tones) {
    expect(tone).toBeGreaterThanOrEqual(STONE_FLOOR.baseTone - STONE_FLOOR.toneSpread / 2);
    expect(tone).toBeLessThanOrEqual(STONE_FLOOR.baseTone + STONE_FLOOR.toneSpread / 2);
  }
  expect(new Set(tones.map((tone) => tone.toFixed(4))).size).toBeGreaterThan(20);
});

test('the floor is flat, fills the arena radius and never pokes past the wall', () => {
  const geometry = stoneFloorGeometry(20);
  const positions = geometry.getAttribute('position');
  let farthest = 0;
  for (let index = 0; index < positions.count; index += 1) {
    expect(positions.getY(index)).toBe(0);
    farthest = Math.max(farthest, Math.hypot(positions.getX(index), positions.getZ(index)));
  }
  expect(farthest).toBeLessThanOrEqual(20 + 1e-4);
  expect(farthest).toBeGreaterThan(19.5);
});

test('slabs are separated by grout gaps and carry cool stone vertex colors', () => {
  const geometry = stoneFloorGeometry(20);
  const colors = geometry.getAttribute('color');
  expect(colors.count).toBe(geometry.getAttribute('position').count);
  expect(colors.getZ(0)).toBeGreaterThan(colors.getX(0));
  const positions = geometry.getAttribute('position');
  const radii = Array.from({ length: positions.count }, (_, index) => Math.hypot(positions.getX(index), positions.getZ(index)));
  const firstOuter = STONE_FLOOR.ringWidthMeters - STONE_FLOOR.gapMeters / 2;
  expect(radii.some((radius) => radius > firstOuter + 1e-6 && radius < firstOuter + STONE_FLOOR.gapMeters - 1e-6)).toBe(false);
});

test('normals point up so the moonlight lights the floor', () => {
  const normals = stoneFloorGeometry(6).getAttribute('normal');
  expect(normals.getY(0)).toBeCloseTo(1, 6);
});
