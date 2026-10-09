import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { WorldRenderer } from './three-arena';

// SPEC §9: danger, shots and braziers glow; the threshold keeps the dark stone from blooming.
export const BLOOM = { strength: 0.85, radius: 0.45, threshold: 0.6 } as const;

export class BloomRenderer implements WorldRenderer {
  private readonly composer: EffectComposer;
  private readonly bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  private scenePass?: RenderPass;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.composer = new EffectComposer(renderer);
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.scenePass) this.buildPasses(scene, camera);
    this.composer.render();
  }

  dispose(): void {
    this.bloom.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private buildPasses(scene: THREE.Scene, camera: THREE.Camera): void {
    this.scenePass = new RenderPass(scene, camera);
    this.composer.addPass(this.scenePass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
}
