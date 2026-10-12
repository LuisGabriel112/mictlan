import * as THREE from 'three';
import { SCENERY_PIECES, type SceneryKey } from './atmosphere-config';
import type { Warn } from './models';

export interface SceneryModel {
  template: THREE.Object3D;
  height: number;
  minY: number;
  centerX: number;
  centerZ: number;
  radius: number;
}

export interface ScenerySource {
  load(key: SceneryKey): Promise<SceneryModel | undefined>;
}

export type SceneryLoad = (url: string) => Promise<THREE.Object3D>;
export interface SceneryLoaders { gltf: SceneryLoad; fbx: SceneryLoad }

export function measureScenery(template: THREE.Object3D): SceneryModel {
  template.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(template);
  const size = bounds.getSize(new THREE.Vector3());
  if (!(size.y > 0) || !Number.isFinite(size.length())) throw new Error('Modelo sin dimensiones válidas');
  const center = bounds.getCenter(new THREE.Vector3());
  return { template, height: size.y, minY: bounds.min.y, centerX: center.x, centerZ: center.z,
    radius: Math.hypot(size.x, size.z) / 2 };
}

export class SceneryLibrary implements ScenerySource {
  private readonly files = new Map<SceneryKey, Promise<SceneryModel | undefined>>();

  constructor(private readonly loaders: SceneryLoaders, private readonly baseUrl: string, private readonly warn: Warn) {}

  load(key: SceneryKey): Promise<SceneryModel | undefined> {
    const cached = this.files.get(key);
    if (cached) return cached;
    const pending = this.prepare(key);
    this.files.set(key, pending);
    return pending;
  }

  private async prepare(key: SceneryKey): Promise<SceneryModel | undefined> {
    const { file, format } = SCENERY_PIECES[key];
    try {
      return measureScenery(await this.loaders[format](`${this.baseUrl}${file}`));
    } catch (error: unknown) {
      this.warn(`[escenario] No se pudo cargar ${file}; se conserva el escenario procedural (${String(error)})`);
      return undefined;
    }
  }
}
