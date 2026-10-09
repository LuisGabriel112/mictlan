import * as THREE from 'three';
import { BloomRenderer } from './bloom-renderer';
import { ThreeArenaWorld } from './three-arena';

const EXPOSURE = 1.15;

// Composition root for the real WebGL renderer; everything else receives it injected.
export function createBrowserWorld(container: HTMLElement, pixelRatio: number): ThreeArenaWorld {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.domElement.className = 'world-canvas';
  // Prepended so the transparent Phaser canvas, appended later, stays on top and keeps the input.
  container.prepend(renderer.domElement);
  return new ThreeArenaWorld(new BloomRenderer(renderer));
}
