import { expect, test, vi } from 'vitest';
import type * as Phaser from 'phaser';
import { CombatReadingView } from '../src/scene/combat-reading-view';
import { room, entity } from './fixtures';
import { legacyProjection } from './world-fixtures';
import { sceneFixture } from './phaser-fixtures';

function readingFixture() {
  const scene = sceneFixture();
  const track = vi.fn();
  const view = new CombatReadingView(scene as unknown as Phaser.Scene, track);
  return { view, labels: scene.labels, panels: scene.graphics[0], track };
}

const viewport = { width: 1280, height: 720, project: legacyProjection };
const snapshot = room([entity({ id: 'h', classId: 'healer' })]);

test('reading view tracks every HUD object and displays header and ordered log rows', () => {
  const { view, labels, panels, track } = readingFixture();
  view.receive([{ type: 'enraged', sourceId: 'boss', tick: 1 }, { type: 'phaseChanged', phase: 2, tick: 2 }], snapshot, 'h', {});
  view.update(snapshot, 0, viewport);
  expect(labels[0].text).toBe('00:00 · Fase 1: Los nueve ríos');
  expect(labels[1].text).toBe('Combate');
  expect(labels.slice(2, 4).map((label) => label.text)).toEqual(['¡Enfurecido!', 'Fase 2: Los guías']);
  expect(labels[4].visible).toBe(false);
  expect(panels.fillStyle).toHaveBeenCalledWith(0x1d1726, 0.6);
  expect(panels.fillRect).toHaveBeenCalledWith(864, 348, 400, 252);
  expect(track).toHaveBeenCalledTimes(15);
});

test('reading view pools floating labels, updates style/pose and hides expired entries', () => {
  const { view, labels, track } = readingFixture();
  const damage = { type: 'damage', sourceId: 'boss', targetId: 'h', tick: 1, abilityId: 'autoAttack', amount: 60, critical: false } as const;
  view.receive([damage], snapshot, 'h', {});
  view.update(snapshot, 500, viewport);
  const floating = labels[labels.length - 1];
  expect(floating.text).toBe('60');
  expect(floating.visible).toBe(true);
  expect(floating.setPosition).toHaveBeenCalledWith(640, 348);
  expect(floating.setColor).toHaveBeenCalledWith('#ffffff');
  expect(floating.setAlpha).toHaveBeenCalledWith(0.5);
  expect(floating.setFontSize).toHaveBeenCalledWith(18);
  expect(track).toHaveBeenCalledTimes(16);
  view.update(snapshot, 500, viewport);
  expect(floating.visible).toBe(false);
  view.receive([damage], snapshot, 'h', {});
  view.update(snapshot, 0, viewport);
  expect(track).toHaveBeenCalledTimes(16);
});

test('reading view fits the header inside its protected rectangle', () => {
  const { view, labels } = readingFixture();
  labels[0].width = 640;
  view.update(snapshot, 0, viewport);
  expect(labels[0].setScale).toHaveBeenCalledWith(0.5, 1);
});

test('reading view hides numbers over HUD and clears all reading when reset for lobby', () => {
  const { view, labels, panels } = readingFixture();
  const underAction = room([entity({ id: 'h', x: 0, y: -20 })]);
  view.receive([{ type: 'damage', sourceId: 'boss', targetId: 'h', tick: 1, abilityId: 'autoAttack', amount: 60, critical: true }], underAction, 'h', {});
  view.update(underAction, 0, viewport);
  expect(labels.at(-1)?.visible).toBe(false);
  view.reset();
  view.update(room([], { status: 'lobby' }), 0, viewport);
  expect(labels.every((label) => !label.visible)).toBe(true);
  expect(panels.clear).toHaveBeenCalledTimes(2);
});
