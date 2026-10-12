import { COMBAT_RULES } from '@mictlan/core';
import { ATMOSPHERE, type ScenerySpec } from './atmosphere-config';
import { ISO_VIEW } from './iso-camera';
import { hash01 } from './stone-floor';

export interface SceneryPlacement { x: number; y: number; z: number; rotation: number; height: number }

export function cameraSideAllowsHeight(x: number, z: number, height: number, azimuth = ISO_VIEW.azimuthRadians): boolean {
  return height <= ATMOSPHERE.scenery.nearHeightMeters || x * Math.sin(azimuth) + z * Math.cos(azimuth) < 0;
}

function placementAngle(sample: number, radius: number, footprint: number, height: number): number {
  if (cameraSideAllowsHeight(0, 0, height)) return sample * Math.PI * 2;
  // A margin for the entire canopy keeps tall geometry out of the camera-side half.
  const halfArc = Math.acos(footprint / radius);
  return ISO_VIEW.azimuthRadians + Math.PI + (sample * 2 - 1) * halfArc;
}

function placePiece(spec: ScenerySpec, radiusRatio: number, seed: number, index: number): SceneryPlacement | undefined {
  const height = spec.height[0] + hash01(seed, index * 4) * (spec.height[1] - spec.height[0]);
  const footprint = height * radiusRatio;
  const inner = COMBAT_RULES.arena.wallRadiusMeters + ATMOSPHERE.scenery.innerOffsetMeters + footprint;
  const outer = COMBAT_RULES.arena.wallRadiusMeters + ATMOSPHERE.scenery.outerOffsetMeters - footprint;
  if (inner > outer) return undefined;
  const radius = inner + hash01(seed, index * 4 + 1) * (outer - inner);
  const angle = placementAngle(hash01(seed, index * 4 + 2), radius, footprint, height);
  return { x: Math.sin(angle) * radius, y: 0, z: Math.cos(angle) * radius,
    rotation: hash01(seed, index * 4 + 3) * Math.PI * 2, height };
}

export function sceneryPlacements(spec: ScenerySpec, radiusRatio: number, seed: number): SceneryPlacement[] {
  const placements: SceneryPlacement[] = [];
  for (let index = 0; index < spec.count; index += 1) {
    const placement = placePiece(spec, radiusRatio, seed, index);
    if (placement) placements.push(placement);
  }
  return placements;
}
