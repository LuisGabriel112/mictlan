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

// Colyseus resolves joining after schema reflection, before the first full state.
// That reflected schema serializes to {}; only consume initialized server snapshots.
export function readRoomSnapshot(value: unknown): RoomSnapshot | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fields = value as Record<string, unknown>;
  const status = fields.status;
  if (status !== 'lobby' && status !== 'combat' && status !== 'victory' && status !== 'defeat') return undefined;
  if (typeof fields.code !== 'string') return undefined;
  for (const key of ['tick', 'phase', 'safeRadiusMeters', 'elapsedTicks'] as const) {
    if (typeof fields[key] !== 'number') return undefined;
  }
  for (const key of ['players', 'entities', 'zones'] as const) {
    const map = fields[key];
    if (!map || typeof map !== 'object' || Array.isArray(map)) return undefined;
  }
  // Nested entries are the plain mirror of the authoritative server schema above.
  return value as RoomSnapshot;
}

export function entityRadius({ type }: Pick<EntitySnapshot, 'type'>): number {
  return type === 'player' ? COMBAT_RULES.playerBodyRadiusMeters : ENEMY_RADII[type];
}

export function centerDistance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

export function isLiving(entity: Pick<EntitySnapshot, 'health'>): boolean {
  return entity.health > 0;
}
