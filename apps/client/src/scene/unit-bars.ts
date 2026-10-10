import type { Positions } from '../interpolation';
import { entityRadius, isLiving, type EntitySnapshot, type Point, type RoomSnapshot } from '../snapshot';
import { unitHeight } from '../world-3d/arena-world';
import { HudNode } from './hud-node';

type Project = (world: Point, heightMeters?: number) => Point;

const BAR = { heightPx: 4, minWidthPx: 32, pxPerMeter: 28, liftMeters: 0.5 } as const;

interface UnitBar { track: HudNode; fill: HudNode }

// LoL-style compact bars over each living unit, pooled so frames never create nodes.
export class UnitBars {
  private readonly bars: UnitBar[] = [];

  constructor(private readonly document: Document, private readonly parent: HTMLElement) {}

  sync(snapshot: RoomSnapshot): void {
    const count = Object.keys(snapshot.entities).length;
    while (this.bars.length < count) this.bars.push(this.createBar());
    this.bars.slice(count).forEach(({ track }) => track.visible(false));
  }

  update(snapshot: RoomSnapshot, positions: Positions, project: Project): void {
    const entities = Object.values(snapshot.entities);
    this.bars.forEach((bar, index) => this.draw(bar, entities[index], positions, project));
  }

  private createBar(): UnitBar {
    const track = new HudNode(this.document, this.parent, 'hud-unit-bar');
    return { track, fill: new HudNode(this.document, track.element, 'hud-unit-fill') };
  }

  private draw(bar: UnitBar, entity: EntitySnapshot | undefined, positions: Positions, project: Project): void {
    if (!entity || !isLiving(entity)) {
      bar.track.visible(false);
      return;
    }
    const head = project(positions[entity.id] ?? entity, unitHeight(entity) + BAR.liftMeters);
    const width = Math.max(BAR.minWidthPx, entityRadius(entity) * 2 * BAR.pxPerMeter);
    bar.track.place({ x: head.x - width / 2, y: head.y - BAR.heightPx, width, height: BAR.heightPx }).visible(true);
    bar.fill.fill(entity.health / entity.maxHealth);
  }
}
