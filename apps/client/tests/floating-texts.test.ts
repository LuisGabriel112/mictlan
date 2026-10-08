import { expect, test } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { ageFloatingTexts, enqueueFloatingTexts, floatingTextFor, floatingTextPose } from '../src/floating-texts';
import { floatingTextVisible, projectFloatingText, readingLayout, unitFrameRects } from '../src/reading-layout';
import { entity, room } from './fixtures';

const damage: CombatEvent = { type: 'damage', tick: 1, sourceId: 'boss', targetId: 'h', abilityId: 'autoAttack', amount: 60, critical: false };
const healing: CombatEvent = { type: 'healing', tick: 1, sourceId: 'h', targetId: 'h', abilityId: 'remedy', amount: 180, effectiveAmount: 120, critical: false };
const snapshot = room([entity({ id: 'h', x: 2, y: 3 })]);

test('floatingTextFor creates white damage at the displayed entity position', () => {
  expect(floatingTextFor(damage, snapshot, { h: { x: 4, y: 5 } })).toEqual({
    x: 4, y: 5, ageMs: 0, lifetimeMs: 1000, text: '60', color: '#ffffff', fontSize: 18,
  });
  expect(floatingTextFor(damage, snapshot, {})?.x).toBe(2);
});

test('floatingTextFor styles critical damage and effective healing', () => {
  expect(floatingTextFor({ ...damage, critical: true }, snapshot, {})).toMatchObject({ color: '#ffe066', fontSize: 26, text: '60' });
  expect(floatingTextFor(healing, snapshot, {})).toMatchObject({ color: '#4cd964', fontSize: 18, text: '+120' });
  expect(floatingTextFor({ ...healing, critical: true }, snapshot, {})).toMatchObject({ color: '#4cd964', fontSize: 26 });
});

test('floatingTextFor ignores missing targets, zero effective healing and other events', () => {
  expect(floatingTextFor(damage, room([]), {})).toBeUndefined();
  expect(floatingTextFor({ ...healing, effectiveAmount: 0 }, snapshot, {})).toBeUndefined();
  expect(floatingTextFor({ type: 'enraged', tick: 1, sourceId: 'boss' }, snapshot, {})).toBeUndefined();
});

test('enqueueFloatingTexts appends every visible number and preserves its inputs', () => {
  const first = floatingTextFor(damage, snapshot, {});
  expect(first).toBeDefined();
  const previous = Object.freeze(first ? [first] : []);
  const queue = enqueueFloatingTexts(previous, [damage, healing], snapshot, {});
  expect(queue.map((entry) => entry.text)).toEqual(['60', '60', '+120']);
  expect(previous).toHaveLength(1);
  expect(enqueueFloatingTexts([], [{ ...healing, effectiveAmount: 0 }], snapshot, {})).toEqual([]);
});

test('ageFloatingTexts rises, fades and expires exactly at one second without mutation', () => {
  const queue = enqueueFloatingTexts([], [damage], snapshot, {});
  expect(floatingTextPose(queue[0])).toEqual({ x: 2, y: 3, alpha: 1 });
  const aged = ageFloatingTexts(queue, 500);
  expect(aged[0].ageMs).toBe(500);
  expect(floatingTextPose(aged[0])).toEqual({ x: 2, y: 3.75, alpha: 0.5 });
  expect(queue[0].ageMs).toBe(0);
  expect(ageFloatingTexts(aged, 499)).toHaveLength(1);
  expect(ageFloatingTexts(aged, 500)).toEqual([]);
  expect(ageFloatingTexts(aged, 1500)).toEqual([]);
  expect(floatingTextPose({ ...queue[0], ageMs: 1500 })).toEqual({ x: 2, y: 4.5, alpha: 0 });
});

test('projectFloatingText uses the centered world camera and upward world y', () => {
  expect(projectFloatingText({ x: 2, y: 3 }, { width: 1000, height: 800, zoom: 0.5 })).toEqual({ x: 532, y: 352 });
});

test('readingLayout reserves frames, action/cast bars and a twelve-line lower right log', () => {
  const layout = readingLayout(1280, 720);
  expect(layout.log).toEqual({ x: 864, y: 348, width: 400, height: 252 });
  expect(layout.header).toEqual({ x: 480, y: 96, width: 320, height: 22 });
  expect(layout.bossCast.y).toBe(126);
  expect(layout.protectedRects).toContainEqual({ x: 364, y: 650, width: 552, height: 54 });
  expect(readingLayout(400, 600).log.width).toBe(368);
});

test('unitFrameRects shares the exact self, target and target cast layout with HUD protection', () => {
  expect(unitFrameRects()).toEqual([
    { x: 16, y: 16, width: 260, height: 50 }, { x: 292, y: 16, width: 260, height: 50 },
    { x: 292, y: 70, width: 260, height: 18 },
  ]);
});

test('floatingTextVisible rejects any overlap with HUD or viewport and accepts open arena', () => {
  const viewport = { width: 1280, height: 720 };
  const obstacles = readingLayout(viewport.width, viewport.height).protectedRects;
  expect(floatingTextVisible({ x: 600, y: 300, width: 40, height: 26 }, viewport, obstacles)).toBe(true);
  for (const rect of obstacles) expect(floatingTextVisible(rect, viewport, obstacles)).toBe(false);
  expect(floatingTextVisible({ x: -1, y: 300, width: 40, height: 26 }, viewport, obstacles)).toBe(false);
  expect(floatingTextVisible({ x: 10, y: -1, width: 40, height: 26 }, viewport, [])).toBe(false);
  expect(floatingTextVisible({ x: 1270, y: 300, width: 40, height: 26 }, viewport, [])).toBe(false);
  expect(floatingTextVisible({ x: 600, y: 710, width: 40, height: 26 }, viewport, [])).toBe(false);
  expect(floatingTextVisible({ x: 0, y: 0, width: 40, height: 26 }, viewport, [])).toBe(true);
  expect(floatingTextVisible({ x: 560, y: 300, width: 40, height: 26 }, viewport, [{ x: 600, y: 300, width: 10, height: 10 }])).toBe(true);
});
