import type * as THREE from 'three';
import { overlay, type BasicMesh } from './flat-mesh';

type MeshFactory = (geometry: THREE.BufferGeometry, material: THREE.MeshBasicMaterial, name: string) => BasicMesh;

// Grows to the busiest frame and then only toggles visibility, so effects never allocate per frame.
export class MeshPool {
  private readonly meshes: BasicMesh[] = [];
  private used = 0;

  constructor(private readonly scene: THREE.Scene, private readonly geometry: THREE.BufferGeometry,
    private readonly name: string, private readonly create: MeshFactory) {}

  begin(): void {
    this.used = 0;
  }

  next(): BasicMesh {
    const mesh = this.meshes[this.used] ?? this.grow();
    this.used += 1;
    mesh.visible = true;
    return mesh;
  }

  end(): void {
    for (let index = this.used; index < this.meshes.length; index += 1) this.meshes[index].visible = false;
  }

  dispose(): void {
    this.meshes.forEach((mesh) => { mesh.removeFromParent(); mesh.material.dispose(); });
    this.meshes.length = 0;
    this.geometry.dispose();
  }

  private grow(): BasicMesh {
    const mesh = this.create(this.geometry, overlay(0xffffff, 1), `${this.name}:${this.meshes.length}`);
    this.meshes.push(mesh);
    this.scene.add(mesh);
    return mesh;
  }
}
