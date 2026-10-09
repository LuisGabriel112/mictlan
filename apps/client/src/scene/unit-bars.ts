import type * as Phaser from 'phaser';
import type { Positions } from '../interpolation';
import { entityRadius, isLiving, type EntitySnapshot, type Point, type RoomSnapshot } from '../snapshot';
import { unitHeight } from '../world-3d/arena-world';

type Project = (world: Point, heightMeters?: number) => Point;

const BAR = { heightPx: 4, minWidthPx: 32, pxPerMeter: 28, liftMeters: 0.5, back: 0x222222, fill: 0x4cd964 } as const;

function drawBar(graphics: Phaser.GameObjects.Graphics, entity: EntitySnapshot, position: Point, project: Project): void {
  const head = project(position, unitHeight(entity) + BAR.liftMeters);
  const width = Math.max(BAR.minWidthPx, entityRadius(entity) * 2 * BAR.pxPerMeter);
  const left = head.x - width / 2;
  const top = head.y - BAR.heightPx;
  const ratio = Math.min(1, Math.max(0, entity.health / entity.maxHealth));
  graphics.fillStyle(BAR.back, 1).fillRect(left, top, width, BAR.heightPx);
  graphics.fillStyle(BAR.fill, 1).fillRect(left, top, width * ratio, BAR.heightPx);
}

// Health bars stay in the Phaser HUD layer until T5.3 replaces them with LoL-style bars.
export function drawUnitBars(graphics: Phaser.GameObjects.Graphics, snapshot: RoomSnapshot, positions: Positions, project: Project): void {
  for (const entity of Object.values(snapshot.entities)) {
    if (isLiving(entity)) drawBar(graphics, entity, positions[entity.id] ?? entity, project);
  }
}
