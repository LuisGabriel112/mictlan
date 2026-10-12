import type * as THREE from 'three';
import type { WorldRenderer } from './three-arena';

export class PlainRenderer implements WorldRenderer {
  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  dispose(): void {
    this.renderer.dispose();
  }
}
