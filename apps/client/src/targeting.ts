import { centerDistance, entityRadius, isLiving, type EntitySnapshot, type Point, type RoomSnapshot } from './snapshot';

const ORIGIN: Point = { x: 0, y: 0 };

function compareIds(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function enemiesByDistance(snapshot: RoomSnapshot, origin: Point): EntitySnapshot[] {
  return Object.values(snapshot.entities)
    .filter((entity) => entity.type !== 'player' && isLiving(entity))
    .sort((left, right) => centerDistance(origin, left) - centerDistance(origin, right) || compareIds(left.id, right.id));
}

export function nextEnemyTarget(snapshot: RoomSnapshot, selfId: string, currentId: string): string | undefined {
  const enemies = enemiesByDistance(snapshot, snapshot.entities[selfId] ?? ORIGIN);
  if (enemies.length === 0) return undefined;
  const currentIndex = enemies.findIndex(({ id }) => id === currentId);
  return enemies[(currentIndex + 1) % enemies.length].id;
}

// Party order shared by F1–F5 and the group frames: self first, then the other players by id.
export function partyOrder(snapshot: RoomSnapshot, selfId: string): string[] {
  const others = Object.values(snapshot.entities)
    .filter((entity) => entity.type === 'player' && entity.id !== selfId)
    .map(({ id }) => id)
    .sort(compareIds);
  return snapshot.entities[selfId] ? [selfId, ...others] : others;
}

export function allyAt(snapshot: RoomSnapshot, selfId: string, index: number): string | undefined {
  return partyOrder(snapshot, selfId)[index - 1];
}

export function entityAtPoint(snapshot: RoomSnapshot, point: Point): string | undefined {
  let closest: { id: string; distance: number } | undefined;
  for (const entity of Object.values(snapshot.entities)) {
    const distance = centerDistance(point, entity);
    if (distance > entityRadius(entity) || (closest && closest.distance <= distance)) continue;
    closest = { id: entity.id, distance };
  }
  return closest?.id;
}
