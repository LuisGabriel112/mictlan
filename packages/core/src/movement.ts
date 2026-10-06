import { COMBAT_RULES } from './data/classes.js';
import type { Position } from './types.js';

export function normalize(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

export function clampToWall(position: Position): Position {
  const { center, wallRadiusMeters } = COMBAT_RULES.arena;
  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= wallRadiusMeters) return position;
  const projected = { x: dx * (wallRadiusMeters / distance), y: dy * (wallRadiusMeters / distance) };
  // Correct only outward rounding so exact projections still land on the wall.
  const correction = Math.hypot(projected.x, projected.y) > wallRadiusMeters ? 1 - Number.EPSILON : 1;
  return { x: center.x + projected.x * correction, y: center.y + projected.y * correction };
}

export function displace(position: Position, direction: Position, distanceMeters: number): Position {
  return clampToWall({
    x: position.x + direction.x * distanceMeters,
    y: position.y + direction.y * distanceMeters,
  });
}
