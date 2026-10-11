import * as THREE from 'three';
import type { EntitySnapshot } from '../snapshot';
import { unitHeight } from './arena-world';

export type ModelKey = 'jaguar' | 'eagle' | 'healer' | 'boss' | 'xolo';
export type UnitAnimation = 'idle' | 'walk' | 'attack' | 'cast' | 'death';

export interface LoadedGltf {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export type GltfLoad = (url: string) => Promise<LoadedGltf>;
export type Warn = (message: string) => void;

export interface UnitModel {
  readonly key: ModelKey;
  readonly template: THREE.Object3D;
  readonly clips: Partial<Record<UnitAnimation, THREE.AnimationClip>>;
  // Normalizes the model to unitHeight with its feet on the ground (T5.4).
  readonly scale: number;
  readonly offsetY: number;
}

export interface ModelSource {
  get(key: ModelKey): UnitModel | undefined;
}

// apps/client/public/models/README.md: fixed file names, CC0 packs.
export const MODEL_FILES: Readonly<Record<ModelKey, string>> = {
  jaguar: 'jaguar.glb', eagle: 'eagle.glb', healer: 'healer.glb', boss: 'boss.glb', xolo: 'xolo.glb',
};
// KayKit characters ship without clips; they share the Rig_Medium skeleton with these files.
export const KAYKIT_RIG_FILES = ['Rig_Medium_General.glb', 'Rig_Medium_MovementBasic.glb'] as const;
// The free pack has no attack or cast clips, so Throw and Use_Item stand in for them.
export const KAYKIT_CLIPS: Readonly<Record<UnitAnimation, string>> = {
  idle: 'Idle_A', walk: 'Walking_A', attack: 'Throw', cast: 'Use_Item', death: 'Death_A',
};
// Xolos never cast.
export const XOLO_CLIPS: Readonly<Partial<Record<UnitAnimation, string>>> = {
  idle: 'Idle', walk: 'Walk', attack: 'Attack', death: 'Death',
};

const MODEL_KEYS = Object.keys(MODEL_FILES) as ModelKey[];

export function modelKey({ type, classId }: Pick<EntitySnapshot, 'type' | 'classId'>): ModelKey {
  if (type !== 'player') return type;
  return classId || 'eagle';
}

export interface AnimationInput {
  living: boolean;
  casting: boolean;
  moving: boolean;
  nowMs: number;
  attackStartMs?: number;
  attackMs: number;
}

// Death wins, then the cast wind-up, then a fresh attack, then legs.
export function unitAnimation(input: AnimationInput): UnitAnimation {
  if (!input.living) return 'death';
  if (input.casting) return 'cast';
  const { attackStartMs, attackMs, nowMs } = input;
  if (attackStartMs !== undefined && nowMs >= attackStartMs && nowMs < attackStartMs + attackMs) return 'attack';
  return input.moving ? 'walk' : 'idle';
}

function pickClips(names: Readonly<Partial<Record<UnitAnimation, string>>>, available: readonly THREE.AnimationClip[]) {
  const clips: Partial<Record<UnitAnimation, THREE.AnimationClip>> = {};
  const missing: string[] = [];
  for (const [animation, name] of Object.entries(names) as [UnitAnimation, string][]) {
    const clip = available.find((item) => item.name === name);
    if (clip) clips[animation] = clip;
    else missing.push(name);
  }
  return { clips, missing };
}

function normalize(key: ModelKey, template: THREE.Object3D): { scale: number; offsetY: number } {
  template.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(template);
  const height = box.max.y - box.min.y;
  if (!(height > 0)) return { scale: 1, offsetY: 0 };
  const scale = unitHeight({ type: key === 'boss' || key === 'xolo' ? key : 'player' }) / height;
  return { scale, offsetY: (0 - box.min.y) * scale };
}

// Loads every unit model once per page; attempts reuse the cached templates (T5.4).
export class ModelLibrary implements ModelSource {
  private readonly files = new Map<string, Promise<LoadedGltf | undefined>>();
  private readonly models = new Map<ModelKey, UnitModel>();
  private readonly warned = new Set<string>();

  constructor(private readonly load: GltfLoad, private readonly baseUrl: string, private readonly warn: Warn) {}

  get(key: ModelKey): UnitModel | undefined {
    return this.models.get(key);
  }

  async preload(): Promise<void> {
    await Promise.all(MODEL_KEYS.map((key) => this.prepare(key)));
  }

  private async prepare(key: ModelKey): Promise<void> {
    const gltf = await this.file(MODEL_FILES[key]);
    if (!gltf) return;
    const names = key === 'xolo' ? XOLO_CLIPS : KAYKIT_CLIPS;
    const available = key === 'xolo' ? gltf.animations : await this.kaykitClips();
    const { clips, missing } = pickClips(names, available);
    if (missing.length > 0) {
      this.warnOnce(`[models] ${MODEL_FILES[key]} sin clips ${missing.join(', ')}; se usa la primitiva`);
      return;
    }
    this.models.set(key, { key, template: gltf.scene, clips, ...normalize(key, gltf.scene) });
  }

  private async kaykitClips(): Promise<THREE.AnimationClip[]> {
    const rigs = await Promise.all(KAYKIT_RIG_FILES.map((name) => this.file(name)));
    return rigs.flatMap((rig) => rig?.animations ?? []);
  }

  private file(name: string): Promise<LoadedGltf | undefined> {
    const cached = this.files.get(name);
    if (cached) return cached;
    const pending = this.load(`${this.baseUrl}${name}`).catch((error: unknown) => {
      this.warnOnce(`[models] no se pudo cargar ${name}; se usa la primitiva (${String(error)})`);
      return undefined;
    });
    this.files.set(name, pending);
    return pending;
  }

  private warnOnce(message: string): void {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    this.warn(message);
  }
}
