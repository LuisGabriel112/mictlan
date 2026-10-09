import * as THREE from 'three';
import { hitFlashFor } from '../hit-flash';
import { entityColor } from '../palette';
import { entityRadius, isLiving, type EntitySnapshot } from '../snapshot';
import { unitHeight, type WorldFrame } from './arena-world';
import { castProgress } from './cast-layer';
import { toScene } from './iso-camera';

type UnitMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;

const DEAD_OPACITY = 0.3;
const BODY_SEGMENTS = 24;
// Readable wind-up: the caster tips toward its target as the cast fills.
const MAX_LEAN_RADIANS = 0.3;
const leanAxis = new THREE.Vector3();

function bodyGeometry(entity: EntitySnapshot): THREE.BufferGeometry {
  const radius = entityRadius(entity);
  const height = unitHeight(entity);
  if (entity.type === 'xolo') return new THREE.ConeGeometry(radius, height, BODY_SEGMENTS);
  return new THREE.CylinderGeometry(radius, radius, height, BODY_SEGMENTS);
}

function freeMesh(mesh: UnitMesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.dispose();
}

export class UnitLayer {
  private readonly meshes = new Map<string, UnitMesh>();

  constructor(private readonly scene: THREE.Scene) {}

  update(frame: WorldFrame): void {
    const entities = Object.values(frame.snapshot.entities);
    for (const entity of entities) this.place(this.meshFor(entity), entity, frame);
    const present = new Set(entities.map(({ id }) => id));
    for (const [id, mesh] of this.meshes) {
      if (present.has(id)) continue;
      freeMesh(mesh);
      this.meshes.delete(id);
    }
  }

  dispose(): void {
    this.meshes.forEach(freeMesh);
    this.meshes.clear();
  }

  private meshFor(entity: EntitySnapshot): UnitMesh {
    const existing = this.meshes.get(entity.id);
    if (existing) return existing;
    const material = new THREE.MeshLambertMaterial({ color: entityColor(entity), emissiveIntensity: 0 });
    const mesh: UnitMesh = new THREE.Mesh(bodyGeometry(entity), material);
    mesh.name = `unit:${entity.id}`;
    this.meshes.set(entity.id, mesh);
    this.scene.add(mesh);
    return mesh;
  }

  private place(mesh: UnitMesh, entity: EntitySnapshot, frame: WorldFrame): void {
    const { x, y, z } = toScene(frame.positions[entity.id] ?? entity, unitHeight(entity) / 2);
    mesh.position.set(x, y, z);
    const living = isLiving(entity);
    mesh.material.transparent = !living;
    mesh.material.opacity = living ? 1 : DEAD_OPACITY;
    this.applyFlash(mesh, entity, frame);
    this.applyLean(mesh, entity, frame);
  }

  private applyLean(mesh: UnitMesh, entity: EntitySnapshot, frame: WorldFrame): void {
    mesh.quaternion.identity();
    const target = entity.cast ? frame.snapshot.entities[entity.cast.targetId] : undefined;
    if (!entity.cast || !target || target === entity) return;
    const from = toScene(frame.positions[entity.id] ?? entity);
    const to = toScene(frame.positions[target.id] ?? target);
    leanAxis.set(to.z - from.z, 0, from.x - to.x);
    if (leanAxis.lengthSq() === 0) return;
    mesh.quaternion.setFromAxisAngle(leanAxis.normalize(), MAX_LEAN_RADIANS * castProgress(entity.cast));
  }

  private applyFlash(mesh: UnitMesh, entity: EntitySnapshot, frame: WorldFrame): void {
    // T4.6: only the boss flashes, so player hits never hide the danger read on allies.
    if (entity.type !== 'boss') return;
    const flash = hitFlashFor(frame.hits, entity.id, frame.nowMs);
    mesh.material.emissive.setHex(flash.color);
    mesh.material.emissiveIntensity = flash.intensity;
    mesh.scale.set(flash.scale, 1, flash.scale);
  }
}
