import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import type { AttackEffect } from '../src/attack-effects';
import { recordHitFlashes } from '../src/hit-flash';
import type { Positions } from '../src/interpolation';
import type { EntitySnapshot } from '../src/snapshot';
import type { WorldFrame } from '../src/world-3d/arena-world';
import type { ModelKey, ModelSource, UnitModel } from '../src/world-3d/models';
import { UnitLayer } from '../src/world-3d/unit-layer';
import { entity, room } from './fixtures';
import { hit } from './hit-flash-fixtures';
import { fakeScene, unitModel } from './model-fixtures';

type Paint = THREE.MeshStandardMaterial;

function source(models: Partial<Record<ModelKey, UnitModel>>): ModelSource & { models: typeof models } {
  return { models, get: (key) => models[key] };
}

function fixture(models: Partial<Record<ModelKey, UnitModel>> = { eagle: unitModel('eagle') }) {
  const scene = new THREE.Scene();
  const library = source(models);
  const clones: THREE.Object3D[] = [];
  const clone = vi.fn((template: THREE.Object3D) => {
    const copy = template.clone();
    clones.push(copy);
    return copy;
  });
  const layer = new UnitLayer(scene, library, clone);
  const draw = (entities: EntitySnapshot[], frame: Partial<WorldFrame> = {}) =>
    layer.update({ snapshot: room(entities), positions: {}, selfId: 'eagle', hits: new Map(), effects: [], nowMs: 0, ...frame });
  return { scene, layer, library, clone, clones, draw };
}

function paint(body: THREE.Object3D): Paint {
  return (body.children[1] as THREE.Mesh<THREE.BufferGeometry, Paint>).material;
}

function shot(sourceId: string, startMs: number, kind: AttackEffect['kind'] = 'projectile'): AttackEffect {
  return { kind, sourceId, targetId: 'boss', startMs, durationMs: 250, color: 0 };
}

test('a loaded model replaces the primitive, standing on the ground at its interpolated position', () => {
  const { scene, clone, clones, draw, library } = fixture();
  draw([entity({ id: 'eagle' })], { positions: { eagle: { x: 4, y: 5 } } });
  expect(clone).toHaveBeenCalledExactlyOnceWith(library.models.eagle!.template);
  const root = scene.getObjectByName('unit:eagle')!;
  expect(root).toBeInstanceOf(THREE.Group);
  expect(root.position.toArray()).toEqual([4, 0, -5]);
  expect(clones[0].scale.x).toBe(0.5);
  expect(clones[0].position.y).toBe(0.25);
});

test('classes without a model keep their primitive and switch once their model arrives', () => {
  const { scene, draw, library } = fixture({});
  draw([entity({ id: 'eagle' })]);
  const primitive = scene.getObjectByName('unit:eagle') as THREE.Mesh;
  expect(primitive.geometry).toBeInstanceOf(THREE.CylinderGeometry);
  const free = vi.spyOn(primitive.geometry, 'dispose');
  library.models.eagle = unitModel('eagle');
  draw([entity({ id: 'eagle' })]);
  expect(free).toHaveBeenCalled();
  expect(scene.getObjectByName('unit:eagle')).toBeInstanceOf(THREE.Group);
});

test('animations follow the unit: idle, walk, attack on its own delivery, cast, then death', () => {
  const { layer, draw } = fixture();
  const at = (nowMs: number, x: number, extra: Partial<EntitySnapshot> = {}, effects: AttackEffect[] = []) => {
    const positions: Positions = { eagle: { x, y: 0 } };
    draw([entity({ id: 'eagle', ...extra })], { nowMs, positions, effects });
    return layer.animationOf('eagle');
  };
  expect(at(0, 0)).toBe('idle');
  expect(at(16, 0.1)).toBe('walk');
  expect(at(400, 0.1)).toBe('idle');
  expect(at(416, 0.1, {}, [shot('someone-else', 416), shot('eagle', 416, 'burst')])).toBe('idle');
  expect(at(432, 0.1, {}, [shot('eagle', 430)])).toBe('attack');
  expect(at(1500, 0.1)).toBe('idle');
  const cast = { abilityId: 'arrow', targetId: 'boss', durationTicks: 30, remainingTicks: 20, interruptible: true };
  expect(at(1516, 0.1, { cast })).toBe('cast');
  expect(at(1532, 0.1, { health: 0 })).toBe('death');
});

test('the attack clip plays out after the short delivery effect leaves the frame', () => {
  const { layer, draw } = fixture({ eagle: unitModel('eagle', fakeScene(), 1) });
  draw([entity({ id: 'eagle' })], { nowMs: 0, effects: [shot('eagle', 0)] });
  draw([entity({ id: 'eagle' })], { nowMs: 900 });
  expect(layer.animationOf('eagle')).toBe('attack');
  draw([entity({ id: 'eagle' })], { nowMs: 1000 });
  expect(layer.animationOf('eagle')).toBe('idle');
});

test('each new delivery restarts the attack clip', () => {
  const { layer, draw, clones } = fixture({ eagle: unitModel('eagle', fakeScene(), 1) });
  const frame = (nowMs: number, startMs: number) => draw([entity({ id: 'eagle' })], { nowMs, effects: [shot('eagle', startMs)] });
  frame(0, 0);
  frame(800, 0);
  const late = clones[0].children[0].position.x;
  frame(900, 900);
  expect(layer.animationOf('eagle')).toBe('attack');
  expect(clones[0].children[0].position.x).toBeLessThan(late);
});

test('the model turns toward where it walks, and toward its target when it stops', () => {
  const boss = entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 5 });
  const { draw, clones } = fixture();
  draw([entity({ id: 'eagle', targetId: 'boss' }), boss], { nowMs: 0, positions: { eagle: { x: 0, y: 0 } } });
  expect(clones[0].rotation.y).toBeCloseTo(Math.PI, 9);
  draw([entity({ id: 'eagle', targetId: 'boss' }), boss], { nowMs: 16, positions: { eagle: { x: 1, y: 0 } } });
  expect(clones[0].rotation.y).toBeCloseTo(Math.PI / 2, 9);
});

test('a dead model fades to 30 % on its own materials; allies sharing the template stay opaque', () => {
  const template = fakeScene();
  const { draw, clones } = fixture({ eagle: unitModel('eagle', template) });
  draw([entity({ id: 'eagle', health: 0 }), entity({ id: 'p2' })]);
  expect(paint(clones[0])).toMatchObject({ opacity: 0.3, transparent: true });
  expect(paint(clones[1])).toMatchObject({ opacity: 1, transparent: false });
  expect(paint(template)).toMatchObject({ opacity: 1, transparent: false });
});

test('the boss model flashes on hits and returns to its own glow afterwards', () => {
  const glow = new THREE.MeshStandardMaterial({ name: 'Glow', emissive: 0x00ffaa, emissiveIntensity: 2 });
  const { draw, clones, scene } = fixture({ boss: unitModel('boss', fakeScene(2, 0, glow)) });
  const boss = entity({ id: 'boss', type: 'boss', classId: '' });
  const hits = recordHitFlashes(new Map(), [hit('boss', true)], 1000);
  draw([boss], { hits, nowMs: 1140 });
  expect(paint(clones[0]).emissive.getHex()).toBe(0xffe066);
  expect(paint(clones[0]).emissiveIntensity).toBeCloseTo(0.5, 6);
  expect(scene.getObjectByName('unit:boss')!.scale.x).toBeCloseTo(1.05, 6);
  draw([boss], { hits, nowMs: 2000 });
  expect(paint(clones[0]).emissive.getHex()).toBe(0x00ffaa);
  expect(paint(clones[0]).emissiveIntensity).toBe(2);
});

test('the class color only tints parts the model leaves unpainted', () => {
  const bare = new THREE.MeshStandardMaterial();
  const { draw, clones } = fixture({ eagle: unitModel('eagle', fakeScene(2, 0, bare)), jaguar: unitModel('jaguar') });
  draw([entity({ id: 'eagle' }), entity({ id: 'jaguar', classId: 'jaguar' })]);
  expect(paint(clones[0]).color.getHex()).toBe(0x4363d8);
  expect(paint(clones[1]).color.getHex()).toBe(0xffffff);
});

test('the caster still leans toward its target while casting', () => {
  const { draw, scene } = fixture();
  const cast = { abilityId: 'arrow', targetId: 'boss', durationTicks: 30, remainingTicks: 15, interruptible: true };
  draw([entity({ id: 'eagle', cast }), entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 5 })]);
  expect(scene.getObjectByName('unit:eagle')!.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(0.1);
});

test('units that leave and dispose free their own materials and mixer, never the cached template', () => {
  const template = fakeScene();
  const { draw, clones, layer, scene } = fixture({ eagle: unitModel('eagle', template) });
  const geometry = vi.spyOn((template.children[1] as THREE.Mesh).geometry, 'dispose');
  draw([entity({ id: 'eagle' }), entity({ id: 'p2' })]);
  const left = vi.spyOn(paint(clones[1]), 'dispose');
  draw([entity({ id: 'eagle' })]);
  expect(left).toHaveBeenCalled();
  expect(scene.getObjectByName('unit:p2')).toBeUndefined();
  const stays = vi.spyOn(paint(clones[0]), 'dispose');
  layer.dispose();
  expect(stays).toHaveBeenCalled();
  expect(scene.getObjectByName('unit:eagle')).toBeUndefined();
  expect(layer.animationOf('eagle')).toBeUndefined();
  expect(geometry).not.toHaveBeenCalled();
});
