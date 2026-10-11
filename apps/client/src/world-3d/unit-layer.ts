import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { hitFlashFor } from '../hit-flash';
import { entityColor } from '../palette';
import { entityRadius, isLiving, type EntitySnapshot, type Point } from '../snapshot';
import { unitHeight, type WorldFrame } from './arena-world';
import { castProgress } from './cast-layer';
import { toScene } from './iso-camera';
import { DEAD_OPACITY, ModelUnit, type CloneModel } from './model-unit';
import { modelKey, type ModelSource, type UnitAnimation } from './models';

type UnitMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
type Unit = { kind: 'primitive'; mesh: UnitMesh } | { kind: 'model'; model: ModelUnit };

const BODY_SEGMENTS = 24;
// Readable wind-up: the caster tips toward its target as the cast fills.
const MAX_LEAN_RADIANS = 0.3;
const leanAxis = new THREE.Vector3();
const NO_MODELS: ModelSource = { get: () => undefined };

function bodyGeometry(entity: EntitySnapshot): THREE.BufferGeometry {
  const radius = entityRadius(entity);
  const height = unitHeight(entity);
  if (entity.type === 'xolo') return new THREE.ConeGeometry(radius, height, BODY_SEGMENTS);
  return new THREE.CylinderGeometry(radius, radius, height, BODY_SEGMENTS);
}

function freeUnit(unit: Unit): void {
  if (unit.kind === 'model') {
    unit.model.dispose();
    return;
  }
  unit.mesh.removeFromParent();
  unit.mesh.geometry.dispose();
  unit.mesh.material.dispose();
}

export class UnitLayer {
  private readonly units = new Map<string, Unit>();
  // Latest melee/projectile delivery per source; reused every frame.
  private readonly attacks = new Map<string, number>();

  constructor(private readonly scene: THREE.Scene, private readonly models: ModelSource = NO_MODELS,
    private readonly clone: CloneModel = cloneSkinned) {}

  update(frame: WorldFrame): void {
    this.collectAttacks(frame);
    const entities = Object.values(frame.snapshot.entities);
    for (const entity of entities) this.place(this.unitFor(entity), entity, frame);
    const present = new Set(entities.map(({ id }) => id));
    for (const [id, unit] of this.units) {
      if (present.has(id)) continue;
      freeUnit(unit);
      this.units.delete(id);
    }
  }

  animationOf(id: string): UnitAnimation | undefined {
    const unit = this.units.get(id);
    return unit?.kind === 'model' ? unit.model.animation : undefined;
  }

  dispose(): void {
    this.units.forEach(freeUnit);
    this.units.clear();
  }

  private collectAttacks(frame: WorldFrame): void {
    this.attacks.clear();
    for (const effect of frame.effects) {
      if (effect.kind === 'burst') continue;
      this.attacks.set(effect.sourceId, Math.max(effect.startMs, this.attacks.get(effect.sourceId) ?? effect.startMs));
    }
  }

  private unitFor(entity: EntitySnapshot): Unit {
    const existing = this.units.get(entity.id);
    if (existing?.kind === 'model') return existing;
    const model = this.models.get(modelKey(entity));
    if (existing && !model) return existing;
    if (existing) freeUnit(existing);
    const unit: Unit = model ? { kind: 'model', model: new ModelUnit(model, entity, this.clone) } : { kind: 'primitive', mesh: primitive(entity) };
    this.units.set(entity.id, unit);
    this.scene.add(unit.kind === 'model' ? unit.model.root : unit.mesh);
    return unit;
  }

  private place(unit: Unit, entity: EntitySnapshot, frame: WorldFrame): void {
    const position = frame.positions[entity.id] ?? entity;
    if (unit.kind === 'model') this.placeModel(unit.model, entity, position, frame);
    else this.placePrimitive(unit.mesh, entity, position, frame);
  }

  private placeModel(model: ModelUnit, entity: EntitySnapshot, position: Point, frame: WorldFrame): void {
    model.update({ entity, position, facing: this.facing(entity, frame), living: isLiving(entity), nowMs: frame.nowMs,
      attackStartMs: this.attacks.get(entity.id),
      // T4.6: only the boss flashes, so player hits never hide the danger read on allies.
      flash: entity.type === 'boss' ? hitFlashFor(frame.hits, entity.id, frame.nowMs) : undefined });
    this.applyLean(model.root, entity, frame);
  }

  private facing(entity: EntitySnapshot, frame: WorldFrame): Point | undefined {
    const targetId = entity.cast?.targetId ?? entity.targetId;
    const target = targetId && targetId !== entity.id ? frame.snapshot.entities[targetId] : undefined;
    return target ? frame.positions[target.id] ?? target : undefined;
  }

  private placePrimitive(mesh: UnitMesh, entity: EntitySnapshot, position: Point, frame: WorldFrame): void {
    const { x, y, z } = toScene(position, unitHeight(entity) / 2);
    mesh.position.set(x, y, z);
    const living = isLiving(entity);
    mesh.material.transparent = !living;
    mesh.material.opacity = living ? 1 : DEAD_OPACITY;
    this.applyFlash(mesh, entity, frame);
    this.applyLean(mesh, entity, frame);
  }

  private applyLean(body: THREE.Object3D, entity: EntitySnapshot, frame: WorldFrame): void {
    body.quaternion.identity();
    const target = entity.cast ? frame.snapshot.entities[entity.cast.targetId] : undefined;
    if (!entity.cast || !target || target === entity) return;
    const from = toScene(frame.positions[entity.id] ?? entity);
    const to = toScene(frame.positions[target.id] ?? target);
    leanAxis.set(to.z - from.z, 0, from.x - to.x);
    if (leanAxis.lengthSq() === 0) return;
    body.quaternion.setFromAxisAngle(leanAxis.normalize(), MAX_LEAN_RADIANS * castProgress(entity.cast));
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

function primitive(entity: EntitySnapshot): UnitMesh {
  const material = new THREE.MeshLambertMaterial({ color: entityColor(entity), emissiveIntensity: 0 });
  const mesh: UnitMesh = new THREE.Mesh(bodyGeometry(entity), material);
  mesh.name = `unit:${entity.id}`;
  mesh.castShadow = true;
  return mesh;
}
