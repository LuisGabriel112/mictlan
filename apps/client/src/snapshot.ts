import { BOSS, COMBAT_RULES, XOLO, type ClassId, type EncounterStatus } from '@mictlan/core';

export interface Point {
  x: number;
  y: number;
}

export interface CastSnapshot {
  abilityId: string;
  targetId: string;
  durationTicks: number;
  remainingTicks: number;
  interruptible: boolean;
  // SPEC §11 telegraphed cone (Golpe del Descarnado); a (0, 0) direction or absence means no area.
  aimX?: number;
  aimY?: number;
  aimDx?: number;
  aimDy?: number;
}

export interface EntitySnapshot extends Point {
  id: string;
  type: 'player' | 'boss' | 'xolo';
  classId: ClassId | '';
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  targetId: string;
  gcdRemainingTicks: number;
  cooldowns: Record<string, { id: string; remainingTicks: number }>;
  auras: Record<string, { id: string; sourceId: string; remainingTicks: number }>;
  cast?: CastSnapshot;
}

export interface ZoneSnapshot extends Point {
  id: string;
  radiusMeters: number;
  remainingTicks: number;
}

// Plain mirror of the server's LobbyState (apps/server/src/schema), read through toJSON().
export interface RoomSnapshot {
  status: EncounterStatus;
  code: string;
  tick: number;
  phase: number;
  safeRadiusMeters: number;
  elapsedTicks: number;
  players: Record<string, { id: string; classId: ClassId | ''; ready: boolean }>;
  zones: Record<string, ZoneSnapshot>;
  entities: Record<string, EntitySnapshot>;
}

const ENEMY_RADII = { boss: BOSS.bodyRadiusMeters, xolo: XOLO.bodyRadiusMeters } as const;

export function entityRadius({ type }: Pick<EntitySnapshot, 'type'>): number {
  return type === 'player' ? COMBAT_RULES.playerBodyRadiusMeters : ENEMY_RADII[type];
}

export function centerDistance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function isLiving(entity: Pick<EntitySnapshot, 'health'>): boolean {
  return entity.health > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Colyseus creates room.state before the first patch; until then toJSON() lacks the collections.
export function isSyncedSnapshot(value: unknown): value is RoomSnapshot {
  if (!isRecord(value) || typeof value.status !== 'string') return false;
  return isRecord(value.players) && isRecord(value.entities) && isRecord(value.zones);
}
