import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';
import { measureScenery } from '../src/world-3d/scenery-models';
import { room } from './fixtures';

function fixture() {
  const template = new THREE.Mesh(new THREE.BoxGeometry(1, 100, 1), new THREE.MeshStandardMaterial());
  const model = measureScenery(template);
  const source = { load: vi.fn(async () => model) };
  const renderer = { domElement: { remove: vi.fn() } as unknown as HTMLCanvasElement, setSize: vi.fn(),
    render: vi.fn<(scene: THREE.Scene, camera: THREE.Camera) => void>(), dispose: vi.fn() };
  const world = new ThreeArenaWorld(renderer, undefined, source);
  const frame = { snapshot: room([]), positions: {}, selfId: '', hits: new Map(), effects: [], nowMs: 0 };
  world.render(frame);
  return { template, world, source, frame, scene: renderer.render.mock.lastCall![0] };
}

test('world frames reuse static batches and exiting releases them while keeping the cached template', async () => {
  const { world, scene, frame, template, source } = fixture();
  await vi.waitFor(() => expect(scene.getObjectByName('scenery:palm')).toBeDefined());
  const batch = scene.getObjectByName('scenery:palm') as THREE.InstancedMesh;
  const matrices = batch.instanceMatrix.array.slice();
  const free = vi.spyOn(batch.geometry, 'dispose');
  const cached = vi.spyOn(template.geometry, 'dispose');
  const loaded = source.load.mock.calls.length;
  world.render({ ...frame, nowMs: 1000 });
  expect(scene.getObjectByName('scenery:palm')).toBe(batch);
  expect(batch.instanceMatrix.array).toEqual(matrices);
  expect(source.load).toHaveBeenCalledTimes(loaded);
  world.dispose();
  expect(free).toHaveBeenCalledOnce();
  expect(cached).not.toHaveBeenCalled();
  expect(scene.getObjectByName('scenery:palm')).toBeUndefined();
  expect(scene.getObjectByName('scenery:pillar')).toBeUndefined();
});
