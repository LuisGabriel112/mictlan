import type { AttackEffect } from '../attack-effects';
import type { HitFlashes } from '../hit-flash';
import type { Positions } from '../interpolation';
import type { EntitySnapshot, Point, RoomSnapshot } from '../snapshot';

export interface WorldFrame {
  snapshot: RoomSnapshot;
  positions: Positions;
  selfId: string;
  destination?: Point;
  hits: HitFlashes;
  effects: readonly AttackEffect[];
  nowMs: number;
}

// The 3D world behind the Phaser HUD (T5.1). ArenaScene only talks to this seam.
export interface ArenaWorld {
  resize(width: number, height: number): void;
  pick(pixel: Point): Point;
  project(world: Point, heightMeters?: number): Point;
  render(frame: WorldFrame): void;
  dispose(): void;
}

// Placeholder body heights until T5.4 brings models; the HUD uses them to place bars over heads.
export const UNIT_HEIGHTS = { player: 1.6, boss: 3, xolo: 1 } as const;

export function unitHeight({ type }: Pick<EntitySnapshot, 'type'>): number {
  return UNIT_HEIGHTS[type];
}
