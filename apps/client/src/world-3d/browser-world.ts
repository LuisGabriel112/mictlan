import * as THREE from 'three';
import { ThreeArenaWorld } from './three-arena';

const BACKGROUND = 0x14101c;

// Composition root for the real WebGL renderer; everything else receives it injected.
export function createBrowserWorld(container: HTMLElement, pixelRatio: number): ThreeArenaWorld {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(BACKGROUND);
  renderer.domElement.className = 'world-canvas';
  // Prepended so the transparent Phaser canvas, appended later, stays on top and keeps the input.
  container.prepend(renderer.domElement);
  return new ThreeArenaWorld(renderer);
}
