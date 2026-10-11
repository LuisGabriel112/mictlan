import { expect, test, vi } from 'vitest';
import { UNIT_HEIGHTS } from '../src/world-3d/arena-world';
import { KAYKIT_CLIPS, ModelLibrary, modelKey, unitAnimation, XOLO_CLIPS, type AnimationInput, type UnitAnimation } from '../src/world-3d/models';
import { entity } from './fixtures';
import { fakeFiles, fakeLoad, fakeScene } from './model-fixtures';

function library(files = fakeFiles()) {
  const load = vi.fn(fakeLoad(files));
  const warn = vi.fn();
  return { models: new ModelLibrary(load, '/models/', warn), load, warn };
}

test('every model and each shared KayKit rig file is downloaded once, even across preloads', async () => {
  const { models, load } = library();
  await models.preload();
  await models.preload();
  expect(load).toHaveBeenCalledTimes(7);
  expect(load.mock.calls.map(([url]) => url)).toEqual(expect.arrayContaining(['/models/jaguar.glb', '/models/xolo.glb',
    '/models/Rig_Medium_General.glb', '/models/Rig_Medium_MovementBasic.glb']));
  expect(models.get('boss')).toBe(models.get('boss'));
});

test('KayKit characters borrow the rig clips by the fixed map; xolos use their own clips', async () => {
  const { models } = library();
  await models.preload();
  const eagle = models.get('eagle')!;
  for (const [animation, name] of Object.entries(KAYKIT_CLIPS)) expect(eagle.clips[animation as UnitAnimation]!.name).toBe(name);
  expect(models.get('healer')!.clips.walk).toBe(eagle.clips.walk);
  const xolo = models.get('xolo')!;
  expect(Object.fromEntries(Object.entries(xolo.clips).map(([key, clip]) => [key, clip.name]))).toEqual(XOLO_CLIPS);
  expect(xolo.clips.cast).toBeUndefined();
});

test('models scale to their unit height with the feet on the ground', async () => {
  const files = fakeFiles();
  files['boss.glb'] = { scene: fakeScene(4, -1), animations: [] };
  const { models } = library(files);
  await models.preload();
  expect(models.get('jaguar')).toMatchObject({ scale: UNIT_HEIGHTS.player / 2, offsetY: 0 });
  expect(models.get('boss')!.scale).toBeCloseTo(UNIT_HEIGHTS.boss / 4, 9);
  expect(models.get('boss')!.offsetY).toBeCloseTo(UNIT_HEIGHTS.boss / 4, 9);
  expect(models.get('xolo')!.scale).toBeCloseTo(UNIT_HEIGHTS.xolo / 1.5, 9);
});

test('a missing model file leaves only that class on its primitive and warns once', async () => {
  const files = fakeFiles();
  delete files['healer.glb'];
  const { models, warn } = library(files);
  await models.preload();
  await models.preload();
  expect(models.get('healer')).toBeUndefined();
  expect(models.get('jaguar')).toBeDefined();
  expect(warn).toHaveBeenCalledOnce();
  expect(warn.mock.calls[0][0]).toContain('healer.glb');
});

test('missing clips keep the primitive instead of a frozen T-pose, with one warning per model', async () => {
  const files = fakeFiles();
  delete files['Rig_Medium_MovementBasic.glb'];
  files['xolo.glb'] = { scene: fakeScene(), animations: [] };
  const { models, warn } = library(files);
  await models.preload();
  await models.preload();
  for (const key of ['jaguar', 'eagle', 'healer', 'boss', 'xolo'] as const) expect(models.get(key)).toBeUndefined();
  expect(warn.mock.calls.filter(([message]) => message.includes('Walking_A'))).toHaveLength(4);
  expect(warn.mock.calls.filter(([message]) => message.includes('Rig_Medium_MovementBasic'))).toHaveLength(1);
  expect(warn).toHaveBeenCalledTimes(6);
});

test('each entity maps to its class model; classless players default to the eagle like the palette', () => {
  expect(modelKey(entity({ id: 'a', classId: 'jaguar' }))).toBe('jaguar');
  expect(modelKey(entity({ id: 'a', classId: 'healer' }))).toBe('healer');
  expect(modelKey(entity({ id: 'a', classId: '' }))).toBe('eagle');
  expect(modelKey(entity({ id: 'b', type: 'boss', classId: '' }))).toBe('boss');
  expect(modelKey(entity({ id: 'x', type: 'xolo', classId: '' }))).toBe('xolo');
});

const still: AnimationInput = { living: true, casting: false, moving: false, nowMs: 1000, attackMs: 500 };

test.each<[string, Partial<AnimationInput>, UnitAnimation]>([
  ['standing still', {}, 'idle'],
  ['moving', { moving: true }, 'walk'],
  ['a fresh hit while walking', { moving: true, attackStartMs: 900 }, 'attack'],
  ['an attack that already played out', { moving: true, attackStartMs: 500 }, 'walk'],
  ['casting while moving or attacking', { casting: true, moving: true, attackStartMs: 900 }, 'cast'],
  ['dead, whatever else is true', { living: false, casting: true, moving: true, attackStartMs: 900 }, 'death'],
])('clip state for %s', (_name, input, expected) => {
  expect(unitAnimation({ ...still, ...input })).toBe(expected);
});
