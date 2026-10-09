import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { ATMOSPHERE, Atmosphere } from '../src/world-3d/atmosphere';
import type { WorldFrame } from '../src/world-3d/arena-world';
import { entity, room } from './fixtures';

const boss = (cast = false) => entity({ id: 'boss', type: 'boss', classId: '', x: 3, y: 4,
  cast: cast ? { abilityId: 'lamentOfTheDead', targetId: '', durationTicks: 60, remainingTicks: 30, interruptible: true } : undefined });

function fixture() {
  const scene = new THREE.Scene();
  const atmosphere = new Atmosphere(scene);
  const update = (frame: Partial<WorldFrame>) => atmosphere.update({ snapshot: room([boss()]), positions: {}, selfId: 'p',
    hits: new Map(), effects: [], nowMs: 0, ...frame });
  const lights = (prefix: string) => scene.children.filter((child) => child.name.startsWith(prefix)) as THREE.PointLight[];
  const ashHeights = () => (scene.getObjectByName('ash') as THREE.Points).geometry.getAttribute('position');
  return { scene, atmosphere, update, lights, ashHeights };
}

test('the night is near black with a cold fog that thickens toward the back', () => {
  const { scene } = fixture();
  expect((scene.background as THREE.Color).getHex()).toBe(ATMOSPHERE.background);
  const fog = scene.fog as THREE.Fog;
  expect(fog.color.getHex()).toBe(ATMOSPHERE.fog.color);
  expect(fog.near).toBeLessThan(fog.far);
});

test('a cold moon casts shadows over the whole arena', () => {
  const moon = fixture().scene.getObjectByName('moon') as THREE.DirectionalLight;
  expect(moon.color.getHex()).toBe(ATMOSPHERE.moon.color);
  expect(moon.castShadow).toBe(true);
  expect(moon.shadow.camera.right).toBeGreaterThanOrEqual(COMBAT_RULES.arena.wallRadiusMeters);
});

test('stone pillars ring the wall and every other one carries a turquoise or purple brazier', () => {
  const { scene, lights } = fixture();
  const pillars = scene.children.filter((child) => child.name.startsWith('pillar:'));
  expect(pillars).toHaveLength(ATMOSPHERE.pillars.count);
  for (const pillar of pillars) {
    expect(Math.hypot(pillar.position.x, pillar.position.z)).toBeGreaterThan(COMBAT_RULES.arena.wallRadiusMeters);
  }
  const braziers = lights('brazier-light:');
  expect(braziers).toHaveLength(ATMOSPHERE.pillars.count / 2);
  expect(braziers.map((light) => light.color.getHex())).toEqual(braziers.map((_, index) => ATMOSPHERE.braziers.colors[index % 2]));
  expect(scene.children.filter((child) => child.name.startsWith('flame:'))).toHaveLength(braziers.length);
});

test('brazier light flickers with time, deterministically and within its band', () => {
  const { update, lights } = fixture();
  update({ nowMs: 0 });
  const first = lights('brazier-light:').map((light) => light.intensity);
  update({ nowMs: 730 });
  const later = lights('brazier-light:').map((light) => light.intensity);
  expect(later).not.toEqual(first);
  for (const intensity of [...first, ...later]) {
    expect(intensity).toBeGreaterThanOrEqual(ATMOSPHERE.braziers.intensity * (1 - ATMOSPHERE.braziers.flicker));
    expect(intensity).toBeLessThanOrEqual(ATMOSPHERE.braziers.intensity * (1 + ATMOSPHERE.braziers.flicker));
  }
  update({ nowMs: 0 });
  expect(lights('brazier-light:').map((light) => light.intensity)).toEqual(first);
});

test('a purple light follows the boss and swells while it casts', () => {
  const { update, scene } = fixture();
  const light = scene.getObjectByName('boss-light') as THREE.PointLight;
  update({ positions: { boss: { x: 5, y: 6 } } });
  expect([light.position.x, light.position.z]).toEqual([5, -6]);
  expect(light.visible).toBe(true);
  expect(light.intensity).toBe(ATMOSPHERE.bossLight.idle);
  update({ snapshot: room([boss(true)]) });
  expect(light.intensity).toBe(ATMOSPHERE.bossLight.casting);
  update({ snapshot: room([entity({ id: 'boss', type: 'boss', classId: '', health: 0 })]) });
  expect(light.visible).toBe(false);
  update({ snapshot: room([]) });
  expect(light.visible).toBe(false);
});

test('ash drifts upward with elapsed time and wraps to the floor at the top', () => {
  const { update, ashHeights } = fixture();
  update({ nowMs: 1000 });
  const before = Array.from({ length: ashHeights().count }, (_, index) => ashHeights().getY(index));
  update({ nowMs: 2000 });
  before.forEach((height, index) => {
    const expected = (height + ATMOSPHERE.ash.riseMetersPerSecond) % ATMOSPHERE.ash.topMeters;
    expect(ashHeights().getY(index)).toBeCloseTo(expected, 4);
    expect(ashHeights().getY(index)).toBeGreaterThanOrEqual(0);
    expect(ashHeights().getY(index)).toBeLessThan(ATMOSPHERE.ash.topMeters);
  });
});

test('a long pause does not teleport the ash', () => {
  const { update, ashHeights } = fixture();
  update({ nowMs: 1000 });
  const before = ashHeights().getY(3);
  update({ nowMs: 60_000 });
  const expected = (before + ATMOSPHERE.ash.riseMetersPerSecond * ATMOSPHERE.ash.maxStepSeconds) % ATMOSPHERE.ash.topMeters;
  expect(ashHeights().getY(3)).toBeCloseTo(expected, 4);
});

test('dispose frees the dressing geometries and materials', () => {
  const { scene, atmosphere } = fixture();
  const flame = scene.children.find((child) => child.name.startsWith('flame:')) as THREE.Mesh;
  const free = vi.spyOn(flame.geometry, 'dispose');
  const freeAsh = vi.spyOn((scene.getObjectByName('ash') as THREE.Points).geometry, 'dispose');
  atmosphere.dispose();
  expect(free).toHaveBeenCalled();
  expect(freeAsh).toHaveBeenCalled();
});
