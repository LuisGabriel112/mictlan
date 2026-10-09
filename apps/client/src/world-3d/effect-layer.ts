import * as THREE from 'three';
import { effectProgress, type AttackEffect, type AttackEffectKind } from '../attack-effects';
import { entityRadius, type EntitySnapshot, type Point } from '../snapshot';
import type { WorldFrame } from './arena-world';
import { flat, placeFlat, type BasicMesh } from './flat-mesh';
import { toScene } from './iso-camera';
import { MeshPool } from './mesh-pool';

const HEIGHTS = { projectile: 1.2, slash: 0.9, burst: 0.07 } as const;
const SLASH_REACH_METERS = 1;
const BURST_GROWTH = { start: 0.6, span: 1.2 } as const;

interface Ends { from: Point; to: Point; source: EntitySnapshot; target: EntitySnapshot }

function sphere(geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterial, name: string): BasicMesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

function flatAt(height: number) {
  return (geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterial, name: string) => flat(geometry, material, name, height);
}

function paint(mesh: BasicMesh, color: number, opacity: number): void {
  mesh.material.color.setHex(color);
  mesh.material.opacity = opacity;
}

function drawProjectile(mesh: BasicMesh, ends: Ends, progress: number): void {
  const point = { x: ends.from.x + (ends.to.x - ends.from.x) * progress, y: ends.from.y + (ends.to.y - ends.from.y) * progress };
  const { x, y, z } = toScene(point, HEIGHTS.projectile);
  mesh.position.set(x, y, z);
}

function drawSlash(mesh: BasicMesh, ends: Ends, progress: number): void {
  placeFlat(mesh, ends.from, (entityRadius(ends.source) + SLASH_REACH_METERS) * (0.8 + 0.4 * progress));
  mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(ends.to.y - ends.from.y, ends.to.x - ends.from.x));
}

function drawBurst(mesh: BasicMesh, ends: Ends, progress: number): void {
  placeFlat(mesh, ends.to, (entityRadius(ends.target) + 0.4) * (BURST_GROWTH.start + BURST_GROWTH.span * progress));
}

const DRAWERS: Record<AttackEffectKind, (mesh: BasicMesh, ends: Ends, progress: number) => void> = {
  projectile: drawProjectile, slash: drawSlash, burst: drawBurst,
};

export class EffectLayer {
  private readonly pools: Record<AttackEffectKind, MeshPool>;

  constructor(scene: THREE.Scene) {
    this.pools = {
      projectile: new MeshPool(scene, new THREE.SphereGeometry(0.22, 12, 8), 'effect:projectile', sphere),
      slash: new MeshPool(scene, new THREE.RingGeometry(0.55, 1, 16, 1, -Math.PI / 4, Math.PI / 2), 'effect:slash', flatAt(HEIGHTS.slash)),
      burst: new MeshPool(scene, new THREE.RingGeometry(0.75, 1, 32), 'effect:burst', flatAt(HEIGHTS.burst)),
    };
  }

  update(frame: WorldFrame): void {
    Object.values(this.pools).forEach((pool) => pool.begin());
    for (const effect of frame.effects) this.draw(effect, frame);
    Object.values(this.pools).forEach((pool) => pool.end());
  }

  dispose(): void {
    Object.values(this.pools).forEach((pool) => pool.dispose());
  }

  private draw(effect: AttackEffect, frame: WorldFrame): void {
    const source = frame.snapshot.entities[effect.sourceId];
    const target = frame.snapshot.entities[effect.targetId];
    if (!source || !target) return;
    const ends = { from: frame.positions[source.id] ?? source, to: frame.positions[target.id] ?? target, source, target };
    const progress = effectProgress(effect, frame.nowMs);
    const mesh = this.pools[effect.kind].next();
    paint(mesh, effect.color, effect.kind === 'projectile' ? 1 : 1 - progress);
    DRAWERS[effect.kind](mesh, ends, progress);
  }
}
