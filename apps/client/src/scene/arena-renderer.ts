import type * as Phaser from 'phaser';
import { BOSS_ABILITIES, COMBAT_RULES } from '@mictlan/core';
import type { Positions } from '../interpolation';
import { entityColor } from '../palette';
import { entityRadius, isLiving, type EntitySnapshot, type RoomSnapshot } from '../snapshot';
import { PIXELS_PER_METER, worldToScreen } from '../world-view';

type Graphics = Phaser.GameObjects.Graphics;

const COLORS = { wall: 0xd9c08c, safeRadius: 0xff4444, zone: 0xff2222, self: 0xffffff, target: 0xffe066,
  healthBack: 0x222222, healthFill: 0x4cd964 } as const;
const WIND_WARNING_TICKS = BOSS_ABILITIES.obsidianWind.effect.warningTicks;
const HEALTH_BAR = { heightPx: 4, gapPx: 6 } as const;

export function drawArena(graphics: Graphics, snapshot: RoomSnapshot): void {
  const wallPx = COMBAT_RULES.arena.wallRadiusMeters * PIXELS_PER_METER;
  graphics.lineStyle(4, COLORS.wall, 1).strokeCircle(0, 0, wallPx);
  if (snapshot.status !== 'combat' || snapshot.safeRadiusMeters >= COMBAT_RULES.arena.wallRadiusMeters) return;
  graphics.lineStyle(3, COLORS.safeRadius, 0.9).strokeCircle(0, 0, snapshot.safeRadiusMeters * PIXELS_PER_METER);
}

// Wind circles fill up as their 2 s warning runs out (SPEC §8).
export function drawZones(graphics: Graphics, snapshot: RoomSnapshot): void {
  for (const zone of Object.values(snapshot.zones)) {
    const elapsedRatio = 1 - Math.min(1, zone.remainingTicks / WIND_WARNING_TICKS);
    const center = worldToScreen(zone);
    graphics.fillStyle(COLORS.zone, 0.15 + 0.35 * elapsedRatio);
    graphics.fillCircle(center.x, center.y, zone.radiusMeters * PIXELS_PER_METER);
  }
}

function drawHealthBar(graphics: Graphics, entity: EntitySnapshot, center: { x: number; y: number }, radiusPx: number): void {
  const widthPx = Math.max(radiusPx * 2, PIXELS_PER_METER);
  const top = center.y - radiusPx - HEALTH_BAR.gapPx;
  graphics.fillStyle(COLORS.healthBack, 1).fillRect(center.x - widthPx / 2, top, widthPx, HEALTH_BAR.heightPx);
  const ratio = Math.max(0, entity.health) / entity.maxHealth;
  graphics.fillStyle(COLORS.healthFill, 1).fillRect(center.x - widthPx / 2, top, widthPx * ratio, HEALTH_BAR.heightPx);
}

function drawEntity(graphics: Graphics, entity: EntitySnapshot, position: { x: number; y: number }, marks: Marks): void {
  const center = worldToScreen(position);
  const radiusPx = entityRadius(entity) * PIXELS_PER_METER;
  graphics.fillStyle(entityColor(entity), isLiving(entity) ? 1 : 0.3).fillCircle(center.x, center.y, radiusPx);
  if (entity.id === marks.selfId) graphics.lineStyle(2, COLORS.self, 1).strokeCircle(center.x, center.y, radiusPx + 3);
  if (entity.id === marks.targetId) graphics.lineStyle(3, COLORS.target, 1).strokeCircle(center.x, center.y, radiusPx + 7);
  if (isLiving(entity)) drawHealthBar(graphics, entity, center, radiusPx);
}

interface Marks {
  selfId: string;
  targetId: string;
}

export function drawEntities(graphics: Graphics, snapshot: RoomSnapshot, positions: Positions, selfId: string): void {
  const marks = { selfId, targetId: snapshot.entities[selfId]?.targetId ?? '' };
  for (const entity of Object.values(snapshot.entities)) {
    drawEntity(graphics, entity, positions[entity.id] ?? entity, marks);
  }
}
