import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { BloomRenderer } from '../src/world-3d/bloom-renderer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createBrowserWorld, createModelLibrary } from '../src/world-3d/browser-world';
import { ModelLibrary } from '../src/world-3d/models';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  const WebGLRenderer = vi.fn(function () {
    return { domElement: { className: '' }, shadowMap: { enabled: false, type: 0 }, setPixelRatio: vi.fn(), setSize: vi.fn(),
      render: vi.fn(), dispose: vi.fn() };
  });
  return { ...actual, WebGLRenderer };
});
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function () { return { loadAsync: vi.fn(async () => { throw new Error('offline'); }) }; }),
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
  expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: true });
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
  expect(renderer.shadowMap).toEqual({ enabled: true, type: THREE.PCFSoftShadowMap });
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.toneMappingExposure).toBeGreaterThan(1);
  expect(renderer.domElement.className).toBe('world-canvas');
  expect(container.prepend).toHaveBeenCalledWith(renderer.domElement);
  expect(BloomRenderer).toHaveBeenCalledWith(renderer);
  expect(world).toBeInstanceOf(ThreeArenaWorld);
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
