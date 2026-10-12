import type * as THREE from 'three';
import { ATMOSPHERE, DECORATION_KEYS, SCENERY_PIECES, type SceneryKey } from './atmosphere-config';
import { disposeSceneryBatch, sceneryBatches } from './scenery-instances';
import { sceneryPlacements, type SceneryPlacement } from './scenery-layout';
import type { SceneryModel, ScenerySource } from './scenery-models';

export class SceneryCollection {
  private readonly batches: ReturnType<typeof sceneryBatches> = [];
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, private readonly source: ScenerySource) {}

  async add(key: SceneryKey, placements: (model: SceneryModel) => readonly SceneryPlacement[]): Promise<boolean> {
    const model = await this.source.load(key);
    if (!model || this.disposed) return false;
    const batches = sceneryBatches(model, placements(model), SCENERY_PIECES[key].castShadow);
    batches.forEach((batch) => { batch.name = `scenery:${key}`; this.scene.add(batch); });
    this.batches.push(...batches);
    return batches.length > 0;
  }

  dispose(): void {
    this.disposed = true;
    this.batches.forEach(disposeSceneryBatch);
    this.batches.length = 0;
  }
}

export class SceneryLayer {
  readonly ready: Promise<unknown>;
  private readonly collection: SceneryCollection;

  constructor(scene: THREE.Scene, source: ScenerySource) {
    this.collection = new SceneryCollection(scene, source);
    this.ready = Promise.all(DECORATION_KEYS.map((key, index) => this.collection.add(key, (model) =>
      sceneryPlacements(SCENERY_PIECES[key], model.radius / model.height, ATMOSPHERE.scenery.seed + index))));
  }

  dispose(): void {
    this.collection.dispose();
  }
}
