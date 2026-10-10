import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import type { AttackEffect } from '../src/attack-effects';
import type { CastSnapshot } from '../src/snapshot';
import type { WorldFrame } from '../src/world-3d/arena-world';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';
import { entity, room } from './fixtures';

type BasicMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

const units = [entity({ id: 'eagle', x: 10, y: 0 }), entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0 })];

function fixture() {
  const renderer = { domElement: { remove: vi.fn() } as unknown as HTMLCanvasElement, setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
  const world = new ThreeArenaWorld(renderer);
  const draw = (frame: Partial<WorldFrame>) => {
    world.render({ snapshot: room(units), positions: {}, selfId: 'eagle', hits: new Map(), nowMs: 0, effects: [], ...frame });
    return renderer.render.mock.lastCall![0] as THREE.Scene;
  };
  return { world, draw };
}

function visible(scene: THREE.Scene, prefix: string): BasicMesh[] {
  return scene.children.filter((child) => child.name.startsWith(prefix) && child.visible) as BasicMesh[];
}

function shot(kind: AttackEffect['kind'], color = 0x4363d8): AttackEffect {
  return { kind, sourceId: 'eagle', targetId: 'boss', startMs: 0, durationMs: 200, color };
}

test('a projectile travels from the attacker to the target as the effect progresses', () => {
  const { draw } = fixture();
  let [ball] = visible(draw({ effects: [shot('projectile')], nowMs: 0 }), 'effect:projectile');
  expect([ball.position.x, ball.position.z]).toEqual([10, -0]);
  expect(ball.material.color.getHex()).toBe(0x4363d8);
  [ball] = visible(draw({ effects: [shot('projectile')], nowMs: 100 }), 'effect:projectile');
  expect(ball.position.x).toBeCloseTo(5, 6);
  expect(ball.position.y).toBeGreaterThan(0.5);
});

test('a slash sits at the attacker, faces the target and fades out', () => {
  const { draw } = fixture();
  const [slash] = visible(draw({ effects: [shot('slash', 0xffffff)], nowMs: 100 }), 'effect:slash');
  expect(slash.position.x).toBe(10);
  expect(slash.rotation.z).toBeCloseTo(Math.PI, 6);
  expect(slash.material.opacity).toBeCloseTo(0.5, 6);
});

test('a burst grows on the target and fades out', () => {
  const { draw } = fixture();
  const early = visible(draw({ effects: [shot('burst', 0x4cd964)], nowMs: 0 }), 'effect:burst')[0].scale.x;
  const [burst] = visible(draw({ effects: [shot('burst', 0x4cd964)], nowMs: 150 }), 'effect:burst');
  expect([burst.position.x, burst.position.z]).toEqual([0, -0]);
  expect(burst.scale.x).toBeGreaterThan(early);
  expect(burst.material.opacity).toBeCloseTo(0.25, 6);
});

test('pooled effect meshes are reused and hidden when effects end; unknown units are skipped', () => {
  const { draw } = fixture();
  const first = visible(draw({ effects: [shot('projectile'), shot('projectile')] }), 'effect:projectile');
  expect(first).toHaveLength(2);
  const scene = draw({ effects: [shot('projectile'), { ...shot('projectile'), targetId: 'ghost' }] });
  expect(visible(scene, 'effect:projectile')).toEqual([first[0]]);
  expect(scene.children.filter((child) => child.name.startsWith('effect:projectile'))).toHaveLength(2);
});

function caster(cast: CastSnapshot) {
  return [entity({ id: 'eagle', x: 10, y: 0 }), entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0, cast })];
}

test.each([[true, 0x2ec4b6], [false, 0xff4444]])('a cast (interruptible %s) shows a filling ring in its color', (interruptible, color) => {
  const { draw } = fixture();
  const cast = { abilityId: 'lamentOfTheDead', targetId: 'eagle', durationTicks: 60, remainingTicks: 15, interruptible };
  const scene = draw({ snapshot: room(caster(cast)) });
  const [ring] = visible(scene, 'cast-ring:');
  const [fill] = visible(scene, 'cast-fill:');
  expect(ring.material.color.getHex()).toBe(color);
  expect(fill.material.color.getHex()).toBe(color);
  expect(fill.scale.x / ring.scale.x).toBeCloseTo(0.75, 6);
});

test('the caster leans toward its target while casting and stands up after', () => {
  const { draw } = fixture();
  const cast = { abilityId: 'flayedStrike', targetId: 'eagle', durationTicks: 50, remainingTicks: 0, interruptible: false };
  let boss = draw({ snapshot: room(caster(cast)) }).getObjectByName('unit:boss')!;
  const top = new THREE.Vector3(0, 1, 0).applyQuaternion(boss.quaternion);
  expect(top.x).toBeGreaterThan(0.1);
  expect(Math.abs(top.z)).toBeLessThan(1e-6);
  boss = draw({ snapshot: room(units) }).getObjectByName('unit:boss')!;
  expect(boss.quaternion.equals(new THREE.Quaternion())).toBe(true);
  expect(visible(draw({ snapshot: room(units) }), 'cast-ring:')).toEqual([]);
});

test('a cast without a living target shows the ring but does not lean', () => {
  const { draw } = fixture();
  const cast = { abilityId: 'lamentOfTheDead', targetId: '', durationTicks: 60, remainingTicks: 30, interruptible: true };
  const scene = draw({ snapshot: room(caster(cast)) });
  expect(visible(scene, 'cast-ring:')).toHaveLength(1);
  expect(scene.getObjectByName('unit:boss')!.quaternion.equals(new THREE.Quaternion())).toBe(true);
});

test('dispose frees the pooled effect and cast meshes', () => {
  const { world, draw } = fixture();
  const cast = { abilityId: 'x', targetId: '', durationTicks: 10, remainingTicks: 5, interruptible: true };
  const scene = draw({ snapshot: room(caster(cast)), effects: [shot('slash')] });
  const slashMaterial = vi.spyOn(visible(scene, 'effect:slash')[0].material, 'dispose');
  const castMaterial = vi.spyOn(visible(scene, 'cast-ring:')[0].material, 'dispose');
  world.dispose();
  expect(slashMaterial).toHaveBeenCalled();
  expect(castMaterial).toHaveBeenCalled();
});

test('a telegraphed cone is drawn where it was aimed, pointing along its direction and filling with the cast', () => {
  const { draw } = fixture();
  const cast = { abilityId: 'flayedStrike', targetId: 'eagle', durationTicks: 50, remainingTicks: 25, interruptible: false,
    aimX: 1, aimY: 2, aimDx: 0, aimDy: 1 };
  const scene = draw({ snapshot: room(caster(cast)) });
  const [edge] = visible(scene, 'cone-edge:');
  const [fill] = visible(scene, 'cone-fill:');
  expect([edge.position.x, edge.position.z]).toEqual([1, -2]);
  expect(edge.rotation.z).toBeCloseTo(Math.PI / 2, 6);
  expect(edge.scale.x).toBe(8);
  expect(fill.scale.x).toBeCloseTo(4, 6);
  expect(edge.material.color.getHex()).toBe(0xff4444);
  expect(visible(draw({ snapshot: room(caster({ ...cast, aimDx: 0, aimDy: 0 })) }), 'cone-edge:')).toEqual([]);
});
