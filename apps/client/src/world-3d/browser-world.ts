import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { BloomRenderer } from './bloom-renderer';
import { ModelLibrary, type ModelSource } from './models';
import { ThreeArenaWorld } from './three-arena';
import { SceneryLibrary, type ScenerySource } from './scenery-models';
import { PlainRenderer } from './plain-renderer';
import { parseRenderQuality, type RenderQuality } from './render-quality';

const EXPOSURE = 1.15;

// Composition root for the real WebGL renderer; everything else receives it injected.
export function createBrowserWorld(container: HTMLElement, pixelRatio: number, models: ModelSource, scenery?: ScenerySource,
  quality: RenderQuality = parseRenderQuality('')): ThreeArenaWorld {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(pixelRatio, quality.maxPixelRatio));
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = EXPOSURE;
  renderer.domElement.className = 'world-canvas';
  // Prepended so the transparent Phaser canvas, appended later, stays on top and keeps the input.
  container.prepend(renderer.domElement);
  const output = quality.bloom ? new BloomRenderer(renderer) : new PlainRenderer(renderer);
  return new ThreeArenaWorld(output, models, scenery);
}

export function createSceneryLibrary(baseUrl: string): SceneryLibrary {
  const gltf = new GLTFLoader();
  const fbx = new FBXLoader();
  return new SceneryLibrary({ gltf: async (url) => (await gltf.loadAsync(url)).scene, fbx: (url) => fbx.loadAsync(url) },
    `${baseUrl}models/scenery/`, (message) => console.warn(message));
}

// T5.4: one library per page, so every attempt reuses the downloaded models.
export function createModelLibrary(baseUrl: string): ModelLibrary {
  const loader = new GLTFLoader();
  const library = new ModelLibrary((url) => loader.loadAsync(url), `${baseUrl}models/`, (message) => console.warn(message));
  void library.preload();
  return library;
}
