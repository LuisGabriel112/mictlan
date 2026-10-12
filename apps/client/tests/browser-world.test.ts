import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { BloomRenderer } from '../src/world-3d/bloom-renderer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBrowserWorld, createModelLibrary, createSceneryLibrary } from '../src/world-3d/browser-world';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ModelLibrary } from '../src/world-3d/models';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';
import type { ScenerySource } from '../src/world-3d/scenery-models';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  const WebGLRenderer = vi.fn(function () {
    return { domElement: { className: '', remove: vi.fn() }, shadowMap: { enabled: false, type: 0 }, setPixelRatio: vi.fn(), setSize: vi.fn(),
      render: vi.fn(), dispose: vi.fn() };
  });
  return { ...actual, WebGLRenderer };
});
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function () { return { loadAsync: vi.fn(async () => { throw new Error('offline'); }) }; }),
}));
vi.mock('three/addons/loaders/FBXLoader.js', () => ({
  FBXLoader: vi.fn(function () { return { loadAsync: vi.fn(async () => new THREE.Mesh(new THREE.BoxGeometry())) }; }),
}));
vi.mock('../src/world-3d/bloom-renderer', () => ({
  BloomRenderer: vi.fn(function (renderer: { domElement: unknown }) {
    return { domElement: renderer.domElement, setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
  }),
}));

test('the browser world puts a shadowed, tone-mapped Three canvas with bloom under the Phaser HUD', () => {
  const container = { prepend: vi.fn() };
  const world = createBrowserWorld(container as unknown as HTMLElement, 2, { get: () => undefined });
  const renderer = vi.mocked(THREE.WebGLRenderer).mock.results[0].value;
  expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: false });
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
  expect(renderer.shadowMap).toEqual({ enabled: true, type: THREE.PCFShadowMap });
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.toneMappingExposure).toBeGreaterThan(1);
  expect(renderer.domElement.className).toBe('world-canvas');
  expect(container.prepend).toHaveBeenCalledWith(renderer.domElement);
  expect(BloomRenderer).toHaveBeenCalledWith(renderer);
  expect(world).toBeInstanceOf(ThreeArenaWorld);
});

test('the browser world keeps low pixel ratios but caps high-DPI screens at 1.5', () => {
  vi.mocked(THREE.WebGLRenderer).mockClear();
  createBrowserWorld({ prepend: vi.fn() } as unknown as HTMLElement, 1, { get: () => undefined });
  expect(vi.mocked(THREE.WebGLRenderer).mock.results[0].value.setPixelRatio).toHaveBeenCalledWith(1);
});

test('the model library preloads every model from the public models folder once per page', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const library = createModelLibrary('/base/');
  expect(library).toBeInstanceOf(ModelLibrary);
  const loader = vi.mocked(GLTFLoader).mock.results[0].value;
  await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(5));
  expect(loader.loadAsync).toHaveBeenCalledWith('/base/models/jaguar.glb');
  expect(loader.loadAsync).toHaveBeenCalledWith('/base/models/xolo.glb');
  expect(library.get('jaguar')).toBeUndefined();
  warn.mockRestore();
});

test('browser scenery adapters use each installed loader and the public base URL', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const library = createSceneryLibrary('/base/');
  expect(await library.load('pillar')).toBeUndefined();
  expect(await library.load('palm')).toBeDefined();
  const gltf = vi.mocked(GLTFLoader).mock.results.at(-1)!.value;
  const fbx = vi.mocked(FBXLoader).mock.results.at(-1)!.value;
  expect(gltf.loadAsync).toHaveBeenCalledWith('/base/models/scenery/pillar.gltf');
  expect(fbx.loadAsync).toHaveBeenCalledWith('/base/models/scenery/PalmTree_1.fbx');
  gltf.loadAsync.mockResolvedValueOnce({ scene: new THREE.Mesh(new THREE.BoxGeometry()) });
  expect(await library.load('torch')).toBeDefined();
  warn.mockRestore();
});

test('the browser passes scenery through the world and atmosphere, then releases it on exit', async () => {
  const container = { prepend: vi.fn() };
  const load = vi.fn<ScenerySource['load']>(async () => undefined);
  const world = createBrowserWorld(container as unknown as HTMLElement, 1, { get: () => undefined }, { load });
  await Promise.resolve();
  expect(load.mock.calls.map(([key]) => key)).toEqual(expect.arrayContaining(['pillar', 'torch', 'palm', 'rock1']));
  world.dispose();
});

test('low quality renders without bloom or shadows at pixel ratio 1', () => {
  vi.mocked(THREE.WebGLRenderer).mockClear();
  vi.mocked(BloomRenderer).mockClear();
  createBrowserWorld({ prepend: vi.fn() } as unknown as HTMLElement, 2, { get: () => undefined }, undefined,
    { bloom: false, shadows: false, maxPixelRatio: 1, showFps: false });
  const renderer = vi.mocked(THREE.WebGLRenderer).mock.results[0].value;
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
  expect(renderer.shadowMap.enabled).toBe(false);
  expect(BloomRenderer).not.toHaveBeenCalled();
});
