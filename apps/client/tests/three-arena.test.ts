import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { recordHitFlashes } from '../src/hit-flash';
import { ENTITY_COLORS } from '../src/palette';
import type { RoomSnapshot } from '../src/snapshot';
import { UNIT_HEIGHTS, type WorldFrame } from '../src/world-3d/arena-world';
import { isoCamera, pickGround, projectToScreen } from '../src/world-3d/iso-camera';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';
import { entity, room } from './fixtures';
import { bossRoom, hit } from './hit-flash-fixtures';

type AnyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material & { opacity: number; color: THREE.Color }>;

function fixture() {
  const renderer = { domElement: { remove: vi.fn() } as unknown as HTMLCanvasElement, setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
  const world = new ThreeArenaWorld(renderer);
  const draw = (frame: Partial<WorldFrame> & Pick<WorldFrame, 'snapshot'>) => {
    world.render({ positions: {}, selfId: 'eagle', hits: new Map(), effects: [], nowMs: 0, ...frame });
    return renderer.render.mock.lastCall![0] as THREE.Scene;
  };
  return { renderer, world, draw };
}

function named(scene: THREE.Scene, name: string): AnyMesh {
  return scene.getObjectByName(name) as AnyMesh;
}

test('units are class-colored shapes standing at their interpolated position', () => {
  const scene = fixture().draw({ snapshot: bossRoom(), positions: { boss: { x: 4, y: 5 } } });
  const boss = named(scene, 'unit:boss');
  expect(boss.material.color.getHex()).toBe(ENTITY_COLORS.boss);
  expect(boss.position.toArray()).toEqual([4, UNIT_HEIGHTS.boss / 2, -5]);
  expect(named(scene, 'unit:eagle').material.color.getHex()).toBe(ENTITY_COLORS.eagle);
  expect(named(scene, 'unit:eagle').position.toArray()).toEqual([10, UNIT_HEIGHTS.player / 2, -0]);
  expect(named(scene, 'unit:xolo').geometry).toBeInstanceOf(THREE.ConeGeometry);
  expect(named(scene, 'unit:boss').geometry).toBeInstanceOf(THREE.CylinderGeometry);
});

test('dead units fade to 30 % and living units stay opaque', () => {
  const { draw } = fixture();
  const scene = draw({ snapshot: room([entity({ id: 'eagle', health: 0 }), entity({ id: 'p2' })]) });
  expect(named(scene, 'unit:eagle').material.opacity).toBe(0.3);
  expect(named(scene, 'unit:eagle').material.transparent).toBe(true);
  expect(named(scene, 'unit:p2').material.opacity).toBe(1);
});

test('selection rings sit under self and target; no target hides the yellow ring', () => {
  const { draw } = fixture();
  let scene = draw({ snapshot: bossRoom() });
  expect(named(scene, 'self-ring').visible).toBe(true);
  expect(named(scene, 'self-ring').position.x).toBe(10);
  expect(named(scene, 'target-ring').visible).toBe(true);
  expect([named(scene, 'target-ring').position.x, named(scene, 'target-ring').position.z]).toEqual([2, -3]);
  scene = draw({ snapshot: room([entity({ id: 'eagle' })]), selfId: 'absent' });
  expect(named(scene, 'self-ring').visible).toBe(false);
  expect(named(scene, 'target-ring').visible).toBe(false);
});

test('the destination marker follows the walk order', () => {
  const { draw } = fixture();
  let scene = draw({ snapshot: bossRoom(), destination: { x: 1, y: 2 } });
  expect(named(scene, 'destination').visible).toBe(true);
  expect([named(scene, 'destination').position.x, named(scene, 'destination').position.z]).toEqual([1, -2]);
  scene = draw({ snapshot: bossRoom() });
  expect(named(scene, 'destination').visible).toBe(false);
});

test('wind zones are red discs whose fill and border follow the warning style', () => {
  const { draw } = fixture();
  const zone = { id: 'z', x: 3, y: 4, radiusMeters: 4, remainingTicks: 0 };
  const scene = draw({ snapshot: room([], { zones: { z: zone } }), nowMs: 200 });
  const disc = named(scene, 'zone:z');
  expect(disc.material.opacity).toBeCloseTo(0.5, 6);
  expect(disc.material.color.getHex()).toBe(0xff2222);
  expect([disc.position.x, disc.position.z, disc.scale.x]).toEqual([3, -4, 4]);
  expect(named(scene, 'zone-border:z').material.opacity).toBeCloseTo(1, 6);
});

test('zones that end are removed from the scene and freed', () => {
  const { draw } = fixture();
  const zone = { id: 'z', x: 0, y: 0, radiusMeters: 4, remainingTicks: 40 };
  const first = draw({ snapshot: room([], { zones: { z: zone } }) });
  const material = named(first, 'zone:z').material;
  const free = vi.spyOn(material, 'dispose');
  const scene = draw({ snapshot: room([]) });
  expect(scene.getObjectByName('zone:z')).toBeUndefined();
  expect(scene.getObjectByName('zone-border:z')).toBeUndefined();
  expect(free).toHaveBeenCalled();
});

test('phase 3 shows the unsafe band between the safe radius and the wall', () => {
  const { draw } = fixture();
  const phaseThree = (safe: number): RoomSnapshot => room([], { phase: 3, safeRadiusMeters: safe });
  let scene = draw({ snapshot: phaseThree(12) });
  const band = named(scene, 'unsafe-band');
  expect(band.visible).toBe(true);
  expect((band.geometry as THREE.RingGeometry).parameters).toMatchObject({ innerRadius: 12, outerRadius: COMBAT_RULES.arena.wallRadiusMeters });
  expect(named(scene, 'safe-edge').scale.x).toBe(12);
  scene = draw({ snapshot: phaseThree(10) });
  expect((named(scene, 'unsafe-band').geometry as THREE.RingGeometry).parameters.innerRadius).toBe(10);
  scene = draw({ snapshot: room([]) });
  expect(named(scene, 'unsafe-band').visible).toBe(false);
  expect(named(scene, 'safe-edge').visible).toBe(false);
});

test.each([[false, 0xffffff, 1.03], [true, 0xffe066, 1.05]])(
  'a hit boss glows and swells (critical %s); other units never flash', (critical, color, swell) => {
    const hits = recordHitFlashes(new Map(), [hit('boss', critical), hit('eagle')], 1000);
    const scene = fixture().draw({ snapshot: bossRoom(), hits, nowMs: critical ? 1140 : 1100 });
    const boss = named(scene, 'unit:boss') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
    expect(boss.material.emissive.getHex()).toBe(color);
    expect(boss.material.emissiveIntensity).toBeCloseTo(0.5, 6);
    expect(boss.scale.x).toBeCloseTo(swell, 6);
    expect(boss.scale.y).toBe(1);
    const eagle = named(scene, 'unit:eagle') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
    expect(eagle.material.emissiveIntensity).toBe(0);
    expect(eagle.scale.x).toBe(1);
  },
);

test('units that leave the snapshot are removed and freed; kept units reuse their mesh', () => {
  const { draw } = fixture();
  const first = draw({ snapshot: bossRoom() });
  const xolo = named(first, 'unit:xolo');
  const freeGeometry = vi.spyOn(xolo.geometry, 'dispose');
  const freeMaterial = vi.spyOn(xolo.material, 'dispose');
  const kept = named(first, 'unit:boss');
  const scene = draw({ snapshot: room([entity({ id: 'eagle' }), entity({ id: 'boss', type: 'boss', classId: '' })]) });
  expect(scene.getObjectByName('unit:xolo')).toBeUndefined();
  expect(freeGeometry).toHaveBeenCalled();
  expect(freeMaterial).toHaveBeenCalled();
  expect(named(scene, 'unit:boss')).toBe(kept);
});

test('the arena floor and stone wall use the core wall radius', () => {
  const scene = fixture().draw({ snapshot: room([]) });
  named(scene, 'floor').geometry.computeBoundingSphere();
  expect(named(scene, 'floor').geometry.boundingSphere!.radius).toBeCloseTo(COMBAT_RULES.arena.wallRadiusMeters, 3);
  expect(named(scene, 'floor').receiveShadow).toBe(true);
  expect((named(scene, 'wall').geometry as THREE.TorusGeometry).parameters.radius).toBe(COMBAT_RULES.arena.wallRadiusMeters);
  expect(named(scene, 'wall').material.color.getHex()).toBe(0xd9c08c);
});

test('resize frames the iso camera and sizes the renderer; pick and project match the rig', () => {
  const { world, renderer, draw } = fixture();
  world.resize(1280, 720);
  expect(renderer.setSize).toHaveBeenLastCalledWith(1280, 720);
  const rig = isoCamera(1280, 720);
  expect(world.pick({ x: 100, y: 200 })).toEqual(pickGround(rig, { x: 100, y: 200 }));
  expect(world.project({ x: 3, y: 4 }, 2)).toEqual(projectToScreen(rig, { x: 3, y: 4 }, 2));
  draw({ snapshot: room([]) });
  const camera = renderer.render.mock.lastCall![1] as THREE.OrthographicCamera;
  expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-rig.halfWidth, rig.halfWidth, rig.halfHeight, -rig.halfHeight]);
  expect(camera.position.toArray()).toEqual([rig.position.x, rig.position.y, rig.position.z]);
});

test('the real Three camera projects ground points to the same pixels as the pure rig', () => {
  const { world, renderer, draw } = fixture();
  world.resize(1000, 600);
  draw({ snapshot: room([]) });
  const camera = renderer.render.mock.lastCall![1] as THREE.OrthographicCamera;
  camera.updateMatrixWorld();
  const ndc = new THREE.Vector3(5, 0, -7).project(camera);
  const pixel = world.project({ x: 5, y: 7 });
  expect((ndc.x + 1) / 2 * 1000).toBeCloseTo(pixel.x, 4);
  expect((1 - ndc.y) / 2 * 600).toBeCloseTo(pixel.y, 4);
});

test('dispose frees every layer and the renderer', () => {
  const { world, renderer, draw } = fixture();
  const scene = draw({ snapshot: bossRoom(), destination: { x: 0, y: 0 } });
  const free = vi.spyOn(named(scene, 'unit:boss').geometry, 'dispose');
  const freeFloor = vi.spyOn(named(scene, 'floor').geometry, 'dispose');
  world.dispose();
  expect(free).toHaveBeenCalled();
  expect(freeFloor).toHaveBeenCalled();
  expect(renderer.dispose).toHaveBeenCalledOnce();
  expect(renderer.domElement.remove).toHaveBeenCalledOnce();
});
