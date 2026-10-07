import { BOSS, BOSS_ABILITIES, CLASSES, COMBAT_RULES } from '@mictlan/core';
import { entityName } from './hud-text';
import { entityColor } from './palette';
import { isLiving, type CastSnapshot, type EntitySnapshot, type Point, type RoomSnapshot } from './snapshot';
import { partyOrder } from './targeting';

export interface BarValue {
  value: number;
  max: number;
  ratio: number;
}

export interface CastBarView {
  abilityName: string;
  progress: number;
  remainingSeconds: number;
  interruptible: boolean;
}

export interface UnitFrameView {
  id: string;
  name: string;
  color: number;
  isSelf: boolean;
  dead: boolean;
  health: BarValue;
  resource?: BarValue;
  cast?: CastBarView;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

// SPEC §8: an interruptible cast gets a distinct border so damage dealers know when to use War Cry.
export const CAST_BORDER = { interruptible: 0x2ec4b6, uninterruptible: 0x888888 } as const;
export const GROUP_FRAME_LAYOUT = { left: 16, top: 150, width: 210, height: 40, gap: 6 } as const;

const ABILITY_NAMES: ReadonlyMap<string, string> = new Map([
  ...Object.values(CLASSES).flatMap(({ abilities }) => abilities.map(({ id, name }) => [id, name] as const)),
  ...Object.values(BOSS_ABILITIES).map(({ id, name }) => [id, name] as const),
]);

function bar(value: number, max: number): BarValue {
  const clamped = Math.max(0, Math.floor(value));
  return { value: clamped, max, ratio: clamped / max };
}

function castBar(cast: CastSnapshot | undefined): CastBarView | undefined {
  if (!cast) return undefined;
  return {
    abilityName: ABILITY_NAMES.get(cast.abilityId) ?? cast.abilityId,
    progress: (cast.durationTicks - cast.remainingTicks) / cast.durationTicks,
    remainingSeconds: cast.remainingTicks / COMBAT_RULES.ticksPerSecond,
    interruptible: cast.interruptible,
  };
}

function unitFrame(entity: EntitySnapshot, selfId: string): UnitFrameView {
  return {
    id: entity.id, name: entityName(entity, selfId), color: entityColor(entity), isSelf: entity.id === selfId,
    dead: !isLiving(entity), health: bar(entity.health, entity.maxHealth),
    resource: entity.maxMana > 0 ? bar(entity.mana, entity.maxMana) : undefined,
    cast: castBar(entity.cast),
  };
}

export function selfFrame(snapshot: RoomSnapshot, selfId: string): UnitFrameView | undefined {
  const self = snapshot.entities[selfId];
  return self ? unitFrame(self, selfId) : undefined;
}

export function targetFrame(snapshot: RoomSnapshot, selfId: string): UnitFrameView | undefined {
  const target = snapshot.entities[snapshot.entities[selfId]?.targetId ?? ''];
  return target ? unitFrame(target, selfId) : undefined;
}

export function bossCastBar(snapshot: RoomSnapshot): CastBarView | undefined {
  return castBar(snapshot.entities[BOSS.id]?.cast);
}

export function castBarBorder({ interruptible }: Pick<CastBarView, 'interruptible'>): number {
  return interruptible ? CAST_BORDER.interruptible : CAST_BORDER.uninterruptible;
}

export function groupFrames(snapshot: RoomSnapshot, selfId: string): UnitFrameView[] {
  return partyOrder(snapshot, selfId).map((id) => unitFrame(snapshot.entities[id], selfId));
}

export function groupFrameRect(index: number): Rect {
  const { left, top, width, height, gap } = GROUP_FRAME_LAYOUT;
  return { x: left, y: top + index * (height + gap), width, height };
}

function contains(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

export function groupFrameAt(snapshot: RoomSnapshot, selfId: string, point: Point): string | undefined {
  return partyOrder(snapshot, selfId).find((_id, index) => contains(groupFrameRect(index), point));
}
