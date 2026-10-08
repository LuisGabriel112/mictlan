import { expect, test, vi } from 'vitest';
import type * as Phaser from 'phaser';
import type { CombatEvent } from '@mictlan/core';
import { ArenaScene } from '../src/scene/ArenaScene';
import { Hud } from '../src/scene/hud';
import { room, entity } from './fixtures';
import { sceneFixture } from './phaser-fixtures';

vi.mock('phaser', async () => {
  const { sceneFixture: makeScene } = await import('./phaser-fixtures');
  return { Scene: class { constructor() { Object.assign(this, makeScene()); } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
});

function arenaFixture() {
  let receiveState: (state: { toJSON(): unknown }) => void = () => undefined;
  let receiveEvents: (events: CombatEvent[]) => void = () => undefined;
  const connection = { sessionId: 'h', send: vi.fn(),
    onStateChange: (callback: typeof receiveState) => { receiveState = callback; },
    onMessage: (_type: string, callback: typeof receiveEvents) => { receiveEvents = callback; } };
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const arena = new ArenaScene(connection);
  arena.create();
  const surface = arena as unknown as ReturnType<typeof sceneFixture>;
  return { arena, surface, state: (snapshot: unknown) => receiveState({ toJSON: () => snapshot }),
    events: (events: CombatEvent[]) => receiveEvents(events) };
}

test('Hud connects reading events, clock, relocated boss cast and reset', () => {
  const scene = sceneFixture();
  const hud = new Hud(scene as unknown as Phaser.Scene);
  const snapshot = room([entity({ id: 'h', classId: 'healer' })]);
  hud.receiveCombatEvents([{ type: 'enraged', tick: 1, sourceId: 'boss' }], snapshot, 'h', {});
  hud.update(snapshot, 'h', 0, 0, { width: 1280, height: 720, zoom: 0.5 });
  expect(scene.labels.some((label) => label.text === '¡Enfurecido!')).toBe(true);
  expect(scene.labels.some((label) => label.text === '00:00 · Fase 1: Los nueve ríos')).toBe(true);
  expect(hud.objects).toHaveLength(47);
  hud.resetReading();
  hud.update(room([], { status: 'lobby' }), 'h', 0, 0, { width: 1280, height: 720, zoom: 0.5 });
  expect(scene.labels.some((label) => label.visible && label.text === '¡Enfurecido!')).toBe(false);
});

test('ArenaScene wires received events, dynamic camera exclusion, animated zones and lobby reset', () => {
  const { arena, surface, state, events } = arenaFixture();
  events([{ type: 'enraged', tick: 0, sourceId: 'boss' }]);
  const snapshot = room([entity({ id: 'h' })]);
  state(snapshot);
  events([{ type: 'damage', tick: 1, sourceId: 'boss', targetId: 'h', abilityId: 'autoAttack', amount: 60, critical: false }]);
  arena.update(200, 500);
  expect(surface.labels.some((label) => label.text === '60' && label.visible)).toBe(true);
  expect(surface.cameras.main.ignore).toHaveBeenCalledTimes(2);
  state(room([], { status: 'lobby' }));
  arena.update(300, 0);
  expect(surface.labels.some((label) => label.visible && label.text === '60')).toBe(false);
  vi.unstubAllGlobals();
});
