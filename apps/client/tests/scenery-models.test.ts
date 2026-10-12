import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { SceneryLibrary, measureScenery } from '../src/world-3d/scenery-models';

test('measurement includes hierarchy transforms and centres the footprint above ground', () => {
  const template = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(200, 400, 600));
  mesh.position.set(100, 300, -200);
  template.add(mesh);
  expect(measureScenery(template)).toMatchObject({ template, height: 400, minY: 100, centerX: 100, centerZ: -200 });
  expect(measureScenery(template).radius).toBeCloseTo(Math.hypot(100, 300));
});

test('empty or flat templates fail validation', () => {
  expect(() => measureScenery(new THREE.Group())).toThrow();
  expect(() => measureScenery(new THREE.Mesh(new THREE.BoxGeometry(1, 0, 1)))).toThrow();
});

test('format loaders and bounds are cached across concurrent requests and attempts', async () => {
  const template = new THREE.Mesh(new THREE.BoxGeometry(1, 100, 1));
  const gltf = vi.fn(async () => template);
  const fbx = vi.fn(async () => template);
  const library = new SceneryLibrary({ gltf, fbx }, '/base/models/scenery/', vi.fn());
  const first = library.load('pillar');
  expect(library.load('pillar')).toBe(first);
  expect(await first).toBe(await library.load('pillar'));
  expect(await library.load('palm')).toMatchObject({ height: 100 });
  expect(gltf).toHaveBeenCalledExactlyOnceWith('/base/models/scenery/pillar.gltf');
  expect(fbx).toHaveBeenCalledExactlyOnceWith('/base/models/scenery/PalmTree_1.fbx');
});

test('rejected or synchronously failing loaders warn only once per file', async () => {
  const gltf = vi.fn(() => { throw new Error('offline'); });
  const fbx = vi.fn(async () => { throw new Error('offline'); });
  const warn = vi.fn();
  const library = new SceneryLibrary({ gltf, fbx }, '/models/scenery/', warn);
  for (const key of ['pillar', 'rock1'] as const) {
    expect(await library.load(key)).toBeUndefined();
    expect(await library.load(key)).toBeUndefined();
  }
  expect(warn).toHaveBeenCalledTimes(2);
  expect(warn.mock.calls[0][0]).toContain('pillar.gltf');
  expect(warn.mock.calls[1][0]).toContain('Rock_1.fbx');
});
