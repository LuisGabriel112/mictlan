import type { Positions } from '../interpolation';
import { entityRadius, type EntitySnapshot, type Point, type RoomSnapshot } from '../snapshot';
import { unitHeight } from './arena-world';

type Project = (world: Point, heightMeters?: number) => Point;

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function bodyDistance(entity: EntitySnapshot, position: Point, pixel: Point, project: Project): number | undefined {
  const feet = project(position);
  const head = project(position, unitHeight(entity));
  const side = project({ x: position.x + entityRadius(entity), y: position.y });
  const distance = distanceToSegment(pixel, feet, head);
  return distance <= Math.hypot(side.x - feet.x, side.y - feet.y) ? distance : undefined;
}

// Iso view: a click on a tall body lands behind it on the ground, so pick against the body axis on screen.
export function unitAtPixel(snapshot: RoomSnapshot, positions: Positions, pixel: Point, project: Project): string | undefined {
  let closest: { id: string; distance: number } | undefined;
  for (const entity of Object.values(snapshot.entities)) {
    const distance = bodyDistance(entity, positions[entity.id] ?? entity, pixel, project);
    if (distance === undefined || (closest && closest.distance <= distance)) continue;
    closest = { id: entity.id, distance };
  }
  return closest?.id;
}
