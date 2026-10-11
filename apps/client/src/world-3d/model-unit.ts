import * as THREE from 'three';
import type { HitFlashPose } from '../hit-flash';
import { entityColor } from '../palette';
import type { EntitySnapshot, Point } from '../snapshot';
import { unitAnimation, type UnitAnimation, type UnitModel } from './models';

export type CloneModel = (template: THREE.Object3D) => THREE.Object3D;

type EmissiveMaterial = THREE.Material & { emissive: THREE.Color; emissiveIntensity: number };
type TintableMaterial = THREE.Material & { color: THREE.Color; map: THREE.Texture | null };

interface MaterialSlot {
  material: THREE.Material;
  baseEmissive?: { hex: number; intensity: number };
}

export interface ModelPose {
  entity: EntitySnapshot;
  position: Point;
  facing?: Point;
  living: boolean;
  nowMs: number;
  attackStartMs?: number;
  flash?: HitFlashPose;
}

export const DEAD_OPACITY = 0.3;
const FADE_SECONDS = 0.15;
// Interpolated positions keep moving between ticks; a short hold keeps legs from flickering at tick edges.
const WALK_HOLD_MS = 150;
const MOVE_EPSILON_METERS = 0.001;
const ONE_SHOT: ReadonlySet<UnitAnimation> = new Set(['attack', 'death']);

function isEmissive(material: THREE.Material): material is EmissiveMaterial {
  return 'emissive' in material && material.emissive instanceof THREE.Color;
}

function isTintable(material: THREE.Material): material is TintableMaterial {
  return 'color' in material && material.color instanceof THREE.Color && 'map' in material;
}

// Each unit owns its materials so a dead ally's fade or the boss flash never leaks into other units.
function ownMaterials(body: THREE.Object3D, entity: EntitySnapshot): MaterialSlot[] {
  const slots: MaterialSlot[] = [];
  body.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    // Skinned bounds stay in bind pose; animated limbs must not pop out of view.
    node.frustumCulled = false;
    const own = (source: THREE.Material): THREE.Material => {
      const material = source.clone();
      // Class color only for parts the model leaves unpainted.
      if (isTintable(material) && material.name === '' && !material.map) material.color.setHex(entityColor(entity));
      slots.push({ material, baseEmissive: isEmissive(material) ? { hex: material.emissive.getHex(), intensity: material.emissiveIntensity } : undefined });
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(own) : own(node.material);
  });
  return slots;
}

export class ModelUnit {
  readonly root = new THREE.Group();
  private readonly body: THREE.Object3D;
  private readonly materials: MaterialSlot[];
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Partial<Record<UnitAnimation, THREE.AnimationAction>> = {};
  private current?: UnitAnimation;
  private lastMs?: number;
  private lastPosition?: Point;
  private movedAtMs = Number.NEGATIVE_INFINITY;
  private attackStartMs?: number;
  private playedAttackMs?: number;
  private faded?: boolean;

  constructor(private readonly model: UnitModel, entity: EntitySnapshot, clone: CloneModel) {
    this.body = clone(model.template);
    this.body.scale.setScalar(model.scale);
    this.body.position.y = model.offsetY;
    this.materials = ownMaterials(this.body, entity);
    this.root.add(this.body);
    this.root.name = `unit:${entity.id}`;
    this.mixer = new THREE.AnimationMixer(this.body);
    for (const [animation, clip] of Object.entries(model.clips) as [UnitAnimation, THREE.AnimationClip][]) {
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(animation)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[animation] = action;
    }
  }

  get animation(): UnitAnimation | undefined {
    return this.current;
  }

  update(pose: ModelPose): void {
    this.root.position.set(pose.position.x, 0, -pose.position.y);
    const moving = this.track(pose.position, pose.nowMs);
    if (pose.living && !moving && pose.facing) this.turnToward(pose.facing.x - pose.position.x, pose.facing.y - pose.position.y);
    this.fade(pose.living);
    this.applyFlash(pose.flash);
    // Delivery effects leave the frame after ~250 ms; the attack clip runs its full length.
    if (pose.attackStartMs !== undefined && (this.attackStartMs === undefined || pose.attackStartMs > this.attackStartMs)) {
      this.attackStartMs = pose.attackStartMs;
    }
    const attackMs = (this.model.clips.attack?.duration ?? 0) * 1000;
    const next = unitAnimation({ living: pose.living, casting: Boolean(pose.entity.cast), moving, nowMs: pose.nowMs,
      attackStartMs: this.attackStartMs, attackMs });
    const freshAttack = next === 'attack' && this.attackStartMs !== this.playedAttackMs;
    if (freshAttack) this.playedAttackMs = this.attackStartMs;
    this.play(next, freshAttack);
    const deltaSeconds = this.lastMs === undefined ? 0 : Math.max(0, pose.nowMs - this.lastMs) / 1000;
    this.lastMs = pose.nowMs;
    this.mixer.update(deltaSeconds);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.body);
    this.root.removeFromParent();
    // Geometry and textures belong to the cached template, which outlives each attempt.
    for (const { material } of this.materials) material.dispose();
  }

  private track(position: Point, nowMs: number): boolean {
    const last = this.lastPosition;
    if (last && Math.hypot(position.x - last.x, position.y - last.y) > MOVE_EPSILON_METERS) {
      this.movedAtMs = nowMs;
      this.turnToward(position.x - last.x, position.y - last.y);
    }
    if (last) Object.assign(last, position);
    else this.lastPosition = { x: position.x, y: position.y };
    return nowMs - this.movedAtMs < WALK_HOLD_MS;
  }

  // Models look down +Z; game y maps to scene -z.
  private turnToward(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.body.rotation.y = Math.atan2(dx, -dy);
  }

  private fade(living: boolean): void {
    if (this.faded === !living) return;
    this.faded = !living;
    for (const { material } of this.materials) {
      material.transparent = !living;
      material.opacity = living ? 1 : DEAD_OPACITY;
    }
  }

  private applyFlash(flash: HitFlashPose | undefined): void {
    if (!flash) return;
    for (const { material, baseEmissive } of this.materials) {
      if (!isEmissive(material) || !baseEmissive) continue;
      const lit = flash.intensity > 0;
      material.emissive.setHex(lit ? flash.color : baseEmissive.hex);
      material.emissiveIntensity = lit ? flash.intensity : baseEmissive.intensity;
    }
    this.root.scale.set(flash.scale, 1, flash.scale);
  }

  private play(next: UnitAnimation, restart: boolean): void {
    if (this.current === next && !restart) return;
    const action = this.actions[next];
    if (!action) return;
    const previous = this.current === undefined ? undefined : this.actions[this.current];
    action.reset().fadeIn(FADE_SECONDS).play();
    if (previous && previous !== action) previous.fadeOut(FADE_SECONDS);
    this.current = next;
  }
}
