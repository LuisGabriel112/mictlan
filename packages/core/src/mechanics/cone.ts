import { normalize } from '../movement.js';
import type { BossAbilityEffect, CastAim, Position } from '../types.js';

type ConeEffect = Extract<BossAbilityEffect, { type: 'cone' }>;

// Without a distinct target the cone still needs a direction; north keeps it deterministic.
const DEFAULT_DIRECTION: Position = { x: 0, y: 1 };

export function aimCone(origin: Position, target: Position | undefined): CastAim {
  const direction = target ? normalize(target.x - origin.x, target.y - origin.y) : DEFAULT_DIRECTION;
  const { x: dx, y: dy } = direction.x === 0 && direction.y === 0 ? DEFAULT_DIRECTION : direction;
  return { x: origin.x, y: origin.y, dx, dy };
}

// A body counts as hit when any part of its circle overlaps the cone.
export function insideCone(aim: CastAim, cone: ConeEffect, point: Position, bodyRadiusMeters: number): boolean {
  const offsetX = point.x - aim.x;
  const offsetY = point.y - aim.y;
  const distance = Math.hypot(offsetX, offsetY);
  if (distance > cone.lengthMeters + bodyRadiusMeters) return false;
  if (distance <= bodyRadiusMeters) return true;
  const cosine = Math.min(1, Math.max(-1, (offsetX * aim.dx + offsetY * aim.dy) / distance));
  const excess = Math.acos(cosine) - (cone.angleDegrees * Math.PI) / 360;
  if (excess <= 0) return true;
  return excess < Math.PI / 2 && distance * Math.sin(excess) <= bodyRadiusMeters;
}
