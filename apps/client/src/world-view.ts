import type { Point } from './snapshot';

// SPEC §3: 1 m = 32 px. Screen y grows downward, so world north (+y) is negated.
export const PIXELS_PER_METER = 32;

export function worldToScreen({ x, y }: Point): Point {
  return { x: x * PIXELS_PER_METER, y: -y * PIXELS_PER_METER };
}

export function screenToWorld({ x, y }: Point): Point {
  return { x: x / PIXELS_PER_METER, y: -y / PIXELS_PER_METER };
}
