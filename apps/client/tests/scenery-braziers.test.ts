import { expect, test } from 'vitest';
import * as THREE from 'three';
import { BrazierRing } from '../src/world-3d/brazier-ring';
import { ATMOSPHERE } from '../src/world-3d/atmosphere-config';
import { measureScenery, type ScenerySource } from '../src/world-3d/scenery-models';

function fixture(missing?: string) {
  const scene = new THREE.Scene();
  const model = measureScenery(new THREE.Mesh(new THREE.BoxGeometry(10, 100, 10), new THREE.MeshStandardMaterial()));
  const source: ScenerySource = { load: async (key) => key === missing ? undefined : model };
  const ring = new BrazierRing(scene, source);
  return { scene, ring };
}

test('loaded pillars and torches replace their own primitives at configured heights without changing lights', async () => {
  const { scene, ring } = fixture();
  const lights = scene.children.filter((child) => child instanceof THREE.PointLight);
  const positions = lights.map((light) => light.position.clone());
  await ring.ready;
  expect(scene.getObjectByName('pillar:0')!.visible).toBe(false);
  expect(scene.getObjectByName('flame:0')!.visible).toBe(false);
  const pillar = scene.getObjectByName('scenery:pillar') as THREE.InstancedMesh;
  const torch = scene.getObjectByName('scenery:torch') as THREE.InstancedMesh;
  expect(pillar.count).toBe(ATMOSPHERE.pillars.count);
  expect(torch.count).toBe(lights.length);
  pillar.computeBoundingBox();
  torch.computeBoundingBox();
  expect(pillar.boundingBox!.max.y).toBeCloseTo(ATMOSPHERE.pillars.heightMeters);
  expect(torch.boundingBox!.min.y).toBeCloseTo(ATMOSPHERE.pillars.heightMeters);
  expect(torch.castShadow).toBe(false);
  expect(lights.map((light) => light.position)).toEqual(positions);
  expect(scene.children.filter((child) => child instanceof THREE.PointLight)).toEqual(lights);
});

test.each(['pillar', 'torch'])('a missing %s preserves only its procedural fallback', async (missing) => {
  const { scene, ring } = fixture(missing);
  await ring.ready;
  expect(scene.getObjectByName('pillar:0')!.visible).toBe(missing === 'pillar');
  expect(scene.getObjectByName('flame:0')!.visible).toBe(missing === 'torch');
  expect(scene.getObjectByName(`scenery:${missing}`)).toBeUndefined();
});

test('model replacement preserves the exact procedural flicker, positions and colours', async () => {
  const { scene, ring } = fixture();
  const originalScene = new THREE.Scene();
  const original = new BrazierRing(originalScene);
  await ring.ready;
  ring.update(730);
  original.update(730);
  const lightValues = (root: THREE.Scene) => root.children.filter((child) => child instanceof THREE.PointLight)
    .map((light) => [light.intensity, light.color.getHex(), light.position.toArray()]);
  expect(lightValues(scene)).toEqual(lightValues(originalScene));
  ring.dispose();
  expect(scene.children).toHaveLength(0);
});
