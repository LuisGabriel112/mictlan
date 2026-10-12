import { COMBAT_RULES } from '../data/classes.js';
import type { Position } from '../types.js';

type Obstacle = typeof COMBAT_RULES.arena.obstacles[number];

export function blockedByObstacle(point: Position, obstacle: Obstacle, bodyRadiusMeters = 0): boolean {
  return Math.hypot(point.x - obstacle.x, point.y - obstacle.y) < obstacle.radiusMeters + bodyRadiusMeters;
}

function projectOutside(point: Position, obstacle: Obstacle, radius: number): Position {
  const dx = point.x - obstacle.x;
  const dy = point.y - obstacle.y;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return point;
  const scale = radius / (distance || 1);
  return { x: obstacle.x + (distance ? dx : 1) * scale, y: obstacle.y + (distance ? dy : 0) * scale };
}

function slideAtObstacle(start: Position, end: Position, obstacle: Obstacle, bodyRadius: number): Position {
  const radius = obstacle.radiusMeters + bodyRadius;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ox = start.x - obstacle.x;
  const oy = start.y - obstacle.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (ox * dx + oy * dy);
  const c = ox * ox + oy * oy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (a === 0 || c < 0 || discriminant < 0) return projectOutside(end, obstacle, radius);
  const contact = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (contact < 0 || contact > 1) return projectOutside(end, obstacle, radius);
  const hit = { x: start.x + dx * contact, y: start.y + dy * contact };
  const remainder = { x: dx * (1 - contact), y: dy * (1 - contact) };
  const normal = { x: (hit.x - obstacle.x) / radius, y: (hit.y - obstacle.y) / radius };
  const inward = remainder.x * normal.x + remainder.y * normal.y;
  return projectOutside({ x: hit.x + remainder.x - Math.min(0, inward) * normal.x,
    y: hit.y + remainder.y - Math.min(0, inward) * normal.y }, obstacle, radius);
}

export function resolveObstacles(start: Position, destination: Position, bodyRadiusMeters: number): Position {
  return COMBAT_RULES.arena.obstacles.reduce((point, obstacle) =>
    slideAtObstacle(start, point, obstacle, bodyRadiusMeters), destination);
}

export function blockedLineOfSight(start: Position, end: Position, bodyRadiusMeters: number): boolean {
  return COMBAT_RULES.arena.obstacles.some((obstacle) => lineCrossesObstacle(start, end, obstacle, bodyRadiusMeters));
}

function lineCrossesObstacle(start: Position, end: Position, obstacle: Obstacle, bodyRadius: number): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0 || Math.hypot(end.x - obstacle.x, end.y - obstacle.y) <= obstacle.radiusMeters + bodyRadius) return false;
  const projection = Math.max(0, Math.min(1, ((obstacle.x - start.x) * dx + (obstacle.y - start.y) * dy) / lengthSquared));
  const closest = { x: start.x + projection * dx, y: start.y + projection * dy };
  return projection < 1 && blockedByObstacle(closest, obstacle);
}
