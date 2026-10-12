import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { measureScenery } from '../src/world-3d/scenery-models';
import { sceneryBatches, disposeSceneryBatch } from '../src/world-3d/scenery-instances';
import { SceneryCollection, SceneryLayer } from '../src/world-3d/scenery-layer';

function templateFixture() {
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture(), color: 0x123456 });
  const template = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 100, 20), material);
  mesh.position.set(10, 75, -10);
  template.add(mesh);
  return { template, mesh, material, model: measureScenery(template) };
}

const placements = [{ x: 24, y: 0, z: -5, rotation: Math.PI / 2, height: 1 },
  { x: -24, y: 2.6, z: 5, rotation: 0, height: 0.4 }];

test('batches normalize centimetre assets, preserve materials and place the base at the requested elevation', () => {
  const { model, material, mesh } = templateFixture();
  const [batch] = sceneryBatches(model, placements, false);
  expect(batch.count).toBe(2);
  expect(batch.receiveShadow).toBe(true);
  expect(batch.castShadow).toBe(false);
  expect(batch.material).not.toBe(material);
  expect((batch.material as THREE.MeshStandardMaterial).map).toBe(material.map);
  expect(batch.geometry).not.toBe(mesh.geometry);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(1, matrix);
  const bounds = new THREE.Box3().setFromBufferAttribute(batch.geometry.getAttribute('position') as THREE.BufferAttribute);
  bounds.applyMatrix4(matrix);
  expect(bounds.min.y).toBeCloseTo(2.6);
  expect(bounds.max.y).toBeCloseTo(3);
  expect(bounds.getCenter(new THREE.Vector3()).x).toBeCloseTo(-24);
  expect(bounds.getCenter(new THREE.Vector3()).z).toBeCloseTo(5);
});

test('rotation is applied around the centred base after nested mesh transforms', () => {
  const { model } = templateFixture();
  const [batch] = sceneryBatches(model, placements, true);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  const vertex = new THREE.Vector3(10, 25, -10).applyMatrix4(matrix);
  expect(vertex.x).toBeCloseTo(24);
  expect(vertex.y).toBeCloseTo(0);
  expect(vertex.z).toBeCloseTo(-5);
  expect(batch.castShadow).toBe(true);
});

test('multiple meshes sharing material are merged into one batch per material', () => {
  const { template, mesh, material } = templateFixture();
  template.add(mesh.clone());
  template.add(new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), new THREE.MeshStandardMaterial()));
  const batches = sceneryBatches(measureScenery(template), placements, false);
  expect(batches).toHaveLength(2);
  expect(batches[0].geometry.getAttribute('position').count).toBe(mesh.geometry.toNonIndexed().getAttribute('position').count * 2);
  expect((batches[0].material as THREE.MeshStandardMaterial).color).toEqual(material.color);
});

test('material groups are split correctly, including nonindexed source geometries', () => {
  const first = new THREE.MeshStandardMaterial();
  const second = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BoxGeometry().toNonIndexed();
  geometry.clearGroups();
  geometry.addGroup(0, 18, 0);
  geometry.addGroup(18, 18, 1);
  const batches = sceneryBatches(measureScenery(new THREE.Mesh(geometry, [first, second])), placements, true);
  expect(batches).toHaveLength(2);
  expect(batches.map((batch) => batch.geometry.getAttribute('position').count)).toEqual([18, 18]);
  expect(sceneryBatches(measureScenery(new THREE.Mesh(geometry, first)), [], false)).toEqual([]);
});

test('dispose releases owned GPU resources and detaches instances without releasing cached assets', () => {
  const { model, mesh, material } = templateFixture();
  const scene = new THREE.Scene();
  const [batch] = sceneryBatches(model, placements, false);
  scene.add(batch);
  const owned = [vi.spyOn(batch, 'dispose'), vi.spyOn(batch.geometry, 'dispose'), vi.spyOn(batch.material, 'dispose')];
  const shared = [vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(material, 'dispose'), vi.spyOn(material.map!, 'dispose')];
  disposeSceneryBatch(batch);
  owned.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  shared.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  expect(scene.children).toHaveLength(0);
});

test('collection attaches successful batches and disposes once; failure leaves scene empty', async () => {
  const scene = new THREE.Scene();
  const { model } = templateFixture();
  const load = vi.fn(async () => model);
  const collection = new SceneryCollection(scene, { load });
  expect(await collection.add('palm', () => placements)).toBe(true);
  const batch = scene.children[0] as THREE.InstancedMesh;
  expect(batch.castShadow).toBe(true);
  const dispose = vi.spyOn(batch, 'dispose');
  collection.dispose();
  collection.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  expect(await collection.add('rock1', () => placements)).toBe(false);
  const missing = new SceneryCollection(scene, { load: async () => undefined });
  expect(await missing.add('pillar', () => placements)).toBe(false);
  expect(scene.children).toHaveLength(0);
});

test('late loads never attach after the collection was disposed', async () => {
  const scene = new THREE.Scene();
  const { model } = templateFixture();
  let resolve!: (value: typeof model) => void;
  const collection = new SceneryCollection(scene, { load: () => new Promise((done) => { resolve = done; }) });
  const pending = collection.add('pillar', () => placements);
  collection.dispose();
  resolve(model);
  expect(await pending).toBe(false);
  expect(scene.children).toHaveLength(0);
});

test('decoration is static, contains no new lights and only palms cast shadows', async () => {
  const scene = new THREE.Scene();
  const { model } = templateFixture();
  const load = vi.fn(async () => model);
  const layer = new SceneryLayer(scene, { load });
  await layer.ready;
  expect(load.mock.calls).toHaveLength(7);
  expect(scene.children).toHaveLength(7);
  expect(scene.children.every((child) => child instanceof THREE.InstancedMesh)).toBe(true);
  expect(scene.children.filter((child) => (child as THREE.InstancedMesh).castShadow).map((child) => child.name)).toEqual(['scenery:palm']);
  expect('update' in layer).toBe(false);
  layer.dispose();
  expect(scene.children).toHaveLength(0);
});
