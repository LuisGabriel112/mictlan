import { afterEach, expect, test, vi } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { ArenaScene } from '../src/scene/ArenaScene';
import { room } from './fixtures';
import { bossRoom, hit } from './hit-flash-fixtures';
import { sceneFixture } from './phaser-fixtures';

vi.mock('phaser', async () => {
  const { sceneFixture: makeScene } = await import('./phaser-fixtures');
  return { Scene: class { constructor() { Object.assign(this, makeScene()); } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
});

afterEach(() => vi.unstubAllGlobals());

function flashScene() {
  const connection = { sessionId: 'eagle', send: vi.fn(),
    onStateChange: vi.fn<(callback: (state: { toJSON(): unknown }) => void) => void>(),
    onMessage: vi.fn<(type: string, callback: (events: CombatEvent[]) => void) => void>() };
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const arena = new ArenaScene(connection);
  arena.create();
  const surface = arena as unknown as ReturnType<typeof sceneFixture>;
  const receiveState = connection.onStateChange.mock.calls[0][0];
  const receiveEvents = connection.onMessage.mock.calls[0][1];
  return { arena, surface, connection, receiveState, receiveEvents, drawing: surface.graphics[0] };
}

test('events subscription uses the same scene clock for hits and drawing', () => {
  const { arena, surface, connection, receiveState, receiveEvents, drawing } = flashScene();
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1000;
  receiveEvents([hit()]);
  surface.time.now = 1100;
  arena.update(9999, 16);
  expect(connection.onMessage.mock.calls[0][0]).toBe('events');
  expect(drawing.fillStyle).toHaveBeenCalledWith(0xffffff, 0.5);
  expect(drawing.fillCircle).toHaveBeenCalledTimes(4);
  expect(surface.hudCamera.ignore).toHaveBeenCalledWith(drawing);
});

test('damage before the first synchronized snapshot is safe and retains its timestamp', () => {
  const { arena, surface, receiveState, receiveEvents, drawing } = flashScene();
  receiveState({ toJSON: () => ({}) });
  surface.time.now = 1000;
  receiveEvents([hit('boss', true)]);
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1140;
  arena.update(1140, 16);
  expect(drawing.fillStyle).toHaveBeenCalledWith(0xffe066, 0.5);
});

test('returning to the lobby clears the old attempt flash', () => {
  const { arena, surface, receiveState, receiveEvents, drawing } = flashScene();
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1000;
  receiveEvents([hit()]);
  receiveState({ toJSON: () => room([], { status: 'lobby' }) });
  receiveState({ toJSON: bossRoom });
  arena.update(1000, 16);
  expect(drawing.fillCircle).toHaveBeenCalledTimes(3);
});
