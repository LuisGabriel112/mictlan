import * as THREE from 'three';
import { BOSS_ABILITIES } from '@mictlan/core';
import { entityRadius, isLiving, type CastSnapshot, type EntitySnapshot } from '../snapshot';
import type { WorldFrame } from './arena-world';
import { flat, placeFlat, type BasicMesh } from './flat-mesh';
import { MeshPool } from './mesh-pool';

// Same turquoise as the interruptible cast-bar border (T3.3), so "cortable" reads the same on the floor.
const CAST_COLORS = { interruptible: 0x2ec4b6, locked: 0xff4444 } as const;
const CAST_Y = { fill: 0.06, ring: 0.065, coneFill: 0.07, coneEdge: 0.075 } as const;
const RING_GAP_METERS = 0.6;
const FILL_OPACITY = 0.35;
const MIN_SCALE = 0.001;
const CONE = BOSS_ABILITIES.flayedStrike.effect;
const CONE_ANGLE = (CONE.angleDegrees * Math.PI) / 180;

export function castProgress(cast: CastSnapshot): number {
  if (cast.durationTicks <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - cast.remainingTicks / cast.durationTicks));
}

function castColor(cast: CastSnapshot): number {
  return cast.interruptible ? CAST_COLORS.interruptible : CAST_COLORS.locked;
}

function paintFill(mesh: BasicMesh, color: number): void {
  mesh.material.color.setHex(color);
  mesh.material.opacity = FILL_OPACITY;
}

function flatPool(scene: THREE.Scene, geometry: THREE.BufferGeometry, name: string, height: number): MeshPool {
  return new MeshPool(scene, geometry, name, (g, m, n) => flat(g, m, n, height));
}

export class CastLayer {
  private readonly rings: MeshPool;
  private readonly fills: MeshPool;
  private readonly coneEdges: MeshPool;
  private readonly coneFills: MeshPool;

  constructor(scene: THREE.Scene) {
    this.rings = flatPool(scene, new THREE.RingGeometry(0.9, 1, 48), 'cast-ring', CAST_Y.ring);
    this.fills = flatPool(scene, new THREE.CircleGeometry(1, 48), 'cast-fill', CAST_Y.fill);
    this.coneEdges = flatPool(scene, new THREE.RingGeometry(0.96, 1, 24, 1, -CONE_ANGLE / 2, CONE_ANGLE), 'cone-edge', CAST_Y.coneEdge);
    this.coneFills = flatPool(scene, new THREE.CircleGeometry(1, 24, -CONE_ANGLE / 2, CONE_ANGLE), 'cone-fill', CAST_Y.coneFill);
  }

  update(frame: WorldFrame): void {
    const pools = [this.rings, this.fills, this.coneEdges, this.coneFills];
    pools.forEach((pool) => pool.begin());
    for (const entity of Object.values(frame.snapshot.entities)) {
      if (entity.cast && isLiving(entity)) this.draw(entity, entity.cast, frame);
    }
    pools.forEach((pool) => pool.end());
  }

  dispose(): void {
    [this.rings, this.fills, this.coneEdges, this.coneFills].forEach((pool) => pool.dispose());
  }

  private draw(entity: EntitySnapshot, cast: CastSnapshot, frame: WorldFrame): void {
    const radius = entityRadius(entity) + RING_GAP_METERS;
    const position = frame.positions[entity.id] ?? entity;
    const ring = this.rings.next();
    ring.material.color.setHex(castColor(cast));
    placeFlat(ring, position, radius);
    const fill = this.fills.next();
    paintFill(fill, castColor(cast));
    placeFlat(fill, position, Math.max(MIN_SCALE, radius * castProgress(cast)));
    this.drawCone(cast);
  }

  // SPEC §11: the cone is fixed at cast start, so it is drawn from the synced aim, not the moving boss.
  private drawCone(cast: CastSnapshot): void {
    const dx = cast.aimDx ?? 0;
    const dy = cast.aimDy ?? 0;
    if (dx === 0 && dy === 0) return;
    const origin = { x: cast.aimX ?? 0, y: cast.aimY ?? 0 };
    const angle = Math.atan2(dy, dx);
    const edge = this.coneEdges.next();
    edge.material.color.setHex(castColor(cast));
    placeFlat(edge, origin, CONE.lengthMeters);
    edge.rotation.set(-Math.PI / 2, 0, angle);
    const fill = this.coneFills.next();
    paintFill(fill, castColor(cast));
    placeFlat(fill, origin, Math.max(MIN_SCALE, CONE.lengthMeters * castProgress(cast)));
    fill.rotation.set(-Math.PI / 2, 0, angle);
  }
}
