import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import type { ScenerySource } from './scenery-models';

const COVER_HEIGHT = 1.8;
const COVER_DIAMETER = 2.4;

export class CoverLayer {
  private readonly pieces: THREE.Object3D[] = [];
  private readonly procedural: THREE.Mesh[] = [];
  private disposed = false;

  constructor(private readonly scene: THREE.Scene, source?: ScenerySource) {
    void this.load(source);
  }

  dispose(): void {
    this.disposed = true;
    this.pieces.forEach((piece) => {
      piece.removeFromParent();
    });
    this.procedural.forEach(({ geometry, material }) => {
      geometry.dispose();
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    });
    this.pieces.length = 0;
    this.procedural.length = 0;
  }

  private async load(source?: ScenerySource): Promise<void> {
    const model = await this.loadCoverModel(source);
    if (this.disposed) return;
    COMBAT_RULES.arena.obstacles.forEach((obstacle) => this.place(obstacle, model));
  }

  private async loadCoverModel(source?: ScenerySource) {
    if (!source) return undefined;
    return await source.load('rubble') ?? await source.load('pillar');
  }

  private place(obstacle: typeof COMBAT_RULES.arena.obstacles[number], model: Awaited<ReturnType<ScenerySource['load']>>): void {
    if (!model) {
      this.placeProcedural(obstacle);
      return;
    }
    const root = model.template.clone(true);
    root.scale.set(COVER_DIAMETER / (model.radius * 2), COVER_HEIGHT / model.height,
      COVER_DIAMETER / (model.radius * 2));
    root.position.set(obstacle.x - model.centerX * root.scale.x, -model.minY * root.scale.y,
      -obstacle.y - model.centerZ * root.scale.z);
    root.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = node.receiveShadow = true; });
    this.add(root);
  }

  private placeProcedural(obstacle: typeof COMBAT_RULES.arena.obstacles[number]): void {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, COVER_HEIGHT, 16),
      new THREE.MeshStandardMaterial({ color: 0x68616a, roughness: 0.95 }));
    mesh.position.set(obstacle.x, COVER_HEIGHT / 2, -obstacle.y);
    mesh.castShadow = mesh.receiveShadow = true;
    this.procedural.push(mesh);
    this.add(mesh);
  }

  private add(piece: THREE.Object3D): void {
    piece.name = `cover:${this.pieces.length}`;
    this.pieces.push(piece);
    this.scene.add(piece);
  }
}
