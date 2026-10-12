import { expect, test } from 'vitest';
import { COMBAT_RULES } from '@mictlan/core';
import { ATMOSPHERE, SCENERY_PIECES } from '../src/world-3d/atmosphere-config';
import { cameraSideAllowsHeight, sceneryPlacements } from '../src/world-3d/scenery-layout';
import { ISO_VIEW } from '../src/world-3d/iso-camera';

test('the actual southeast camera permits only low pieces on its near half', () => {
  expect(cameraSideAllowsHeight(5, 5, 1)).toBe(true);
  expect(cameraSideAllowsHeight(5, 5, 1.001)).toBe(false);
  expect(cameraSideAllowsHeight(-5, -5, 8)).toBe(true);
  expect(cameraSideAllowsHeight(0, 0, 8)).toBe(false);
  expect(cameraSideAllowsHeight(5, 0, 8, Math.PI / 2)).toBe(false);
  expect(cameraSideAllowsHeight(-5, 0, 8, Math.PI / 2)).toBe(true);
});

test('seeded positions, rotations and heights repeat and change with the seed', () => {
  const placements = sceneryPlacements(SCENERY_PIECES.rock1, 0.2, 17);
  expect(placements).toEqual(sceneryPlacements(SCENERY_PIECES.rock1, 0.2, 17));
  expect(placements).not.toEqual(sceneryPlacements(SCENERY_PIECES.rock1, 0.2, 18));
  expect(new Set(placements.map((piece) => piece.rotation)).size).toBe(placements.length);
  expect(new Set(placements.map((piece) => piece.height)).size).toBe(placements.length);
});

test.each(['rock1', 'rock2', 'plant', 'bush', 'palm', 'candles', 'rubble'] as const)(
  '%s keeps its entire footprint in the configured ring and obeys target heights', (key) => {
    const spec = SCENERY_PIECES[key];
    const placements = sceneryPlacements(spec, 0.25, 31);
    expect(placements).toHaveLength(spec.count);
    for (const piece of placements) assertPlacement(piece, spec.height, 0.25);
  });

function assertPlacement(piece: ReturnType<typeof sceneryPlacements>[number], heights: readonly number[], radiusRatio: number): void {
  const radius = Math.hypot(piece.x, piece.z);
  const footprint = piece.height * radiusRatio;
  expect(radius - footprint).toBeGreaterThanOrEqual(COMBAT_RULES.arena.wallRadiusMeters + ATMOSPHERE.scenery.innerOffsetMeters);
  expect(radius + footprint).toBeLessThanOrEqual(COMBAT_RULES.arena.wallRadiusMeters + ATMOSPHERE.scenery.outerOffsetMeters);
  expect(piece.height).toBeGreaterThanOrEqual(heights[0]);
  expect(piece.height).toBeLessThanOrEqual(heights[1]);
  expect(piece.y).toBe(0);
  expect(cameraSideAllowsHeight(piece.x, piece.z, piece.height)).toBe(true);
  expect(piece.rotation).toBeGreaterThanOrEqual(0);
  expect(piece.rotation).toBeLessThan(Math.PI * 2);
  if (piece.height <= 1) return;
  const projection = piece.x * Math.sin(ISO_VIEW.azimuthRadians) + piece.z * Math.cos(ISO_VIEW.azimuthRadians);
  expect(projection + footprint).toBeLessThan(0);
}

test('oversized footprints are omitted instead of crossing the arena or exceeding the ring', () => {
  expect(sceneryPlacements(SCENERY_PIECES.palm, 10, 1)).toEqual([]);
});

test('low pieces occupy both halves and declared asset heights match the supplied pack rules', () => {
  const placements = sceneryPlacements(SCENERY_PIECES.rock1, 0, 12);
  expect(placements.some(({ x, z }) => x + z > 0)).toBe(true);
  expect(placements.some(({ x, z }) => x + z < 0)).toBe(true);
  expect(SCENERY_PIECES.palm.height).toEqual([5, 8]);
  expect(SCENERY_PIECES.candles.height).toEqual([0.4, 0.4]);
  expect(SCENERY_PIECES.rubble.height).toEqual([1, 1]);
  expect(SCENERY_PIECES.plant.height).toEqual([0.6, 1]);
  expect(SCENERY_PIECES.bush.height).toEqual([0.6, 1]);
  expect(SCENERY_PIECES.rock1.height).toEqual([0.5, 1]);
  expect(SCENERY_PIECES.rock2.height).toEqual([0.5, 1]);
});
