import * as THREE from 'three';
import { entityRadius, isLiving, type CastSnapshot, type EntitySnapshot } from '../snapshot';
import type { WorldFrame } from './arena-world';
import { flat, placeFlat } from './flat-mesh';
import { MeshPool } from './mesh-pool';

// Same turquoise as the interruptible cast-bar border (T3.3), so "cortable" reads the same on the floor.
const CAST_COLORS = { interruptible: 0x2ec4b6, locked: 0xff4444 } as const;
const CAST_Y = { fill: 0.06, ring: 0.065 } as const;
const RING_GAP_METERS = 0.6;
const FILL_OPACITY = 0.35;
const MIN_SCALE = 0.001;

export function castProgress(cast: CastSnapshot): number {
  if (cast.durationTicks <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - cast.remainingTicks / cast.durationTicks));
}

export class CastLayer {
  private readonly rings: MeshPool;
  private readonly fills: MeshPool;

  constructor(scene: THREE.Scene) {
    this.rings = new MeshPool(scene, new THREE.RingGeometry(0.9, 1, 48), 'cast-ring', (g, m, n) => flat(g, m, n, CAST_Y.ring));
    this.fills = new MeshPool(scene, new THREE.CircleGeometry(1, 48), 'cast-fill', (g, m, n) => flat(g, m, n, CAST_Y.fill));
  }

  update(frame: WorldFrame): void {
    this.rings.begin();
    this.fills.begin();
    for (const entity of Object.values(frame.snapshot.entities)) {
      if (entity.cast && isLiving(entity)) this.draw(entity, entity.cast, frame);
    }
    this.rings.end();
    this.fills.end();
  }

  dispose(): void {
    this.rings.dispose();
    this.fills.dispose();
  }

  private draw(entity: EntitySnapshot, cast: CastSnapshot, frame: WorldFrame): void {
    const color = cast.interruptible ? CAST_COLORS.interruptible : CAST_COLORS.locked;
    const radius = entityRadius(entity) + RING_GAP_METERS;
    const position = frame.positions[entity.id] ?? entity;
    const ring = this.rings.next();
    ring.material.color.setHex(color);
    placeFlat(ring, position, radius);
    const fill = this.fills.next();
    fill.material.color.setHex(color);
    fill.material.opacity = FILL_OPACITY;
    placeFlat(fill, position, Math.max(MIN_SCALE, radius * castProgress(cast)));
  }
}
