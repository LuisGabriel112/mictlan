import { afterEach, expect, test, vi } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { hitFlashFor } from '../src/hit-flash';
import { ArenaScene } from '../src/scene/ArenaScene';
import type { WorldFrame } from '../src/world-3d/arena-world';
import { entity, room } from './fixtures';
import { bossRoom, hit } from './hit-flash-fixtures';
import { sceneFixture } from './phaser-fixtures';
import { fakeWorld, legacyProjection } from './world-fixtures';

vi.mock('phaser', async () => {
  const { sceneFixture: makeScene } = await import('./phaser-fixtures');
  return { Scene: class { constructor() { Object.assign(this, makeScene()); } },
    Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
});

afterEach(() => vi.unstubAllGlobals());

function worldScene() {
  const connection = { sessionId: 'eagle', send: vi.fn(),
    onStateChange: vi.fn<(callback: (state: { toJSON(): unknown }) => void) => void>(),
    onMessage: vi.fn<(type: string, callback: (events: CombatEvent[]) => void) => void>() };
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const world = fakeWorld();
  const arena = new ArenaScene(connection, world);
  arena.create();
  const surface = arena as unknown as ReturnType<typeof sceneFixture>;
  const receiveState = connection.onStateChange.mock.calls[0][0];
  const receiveEvents = connection.onMessage.mock.calls[0][1];
  const click = surface.input.on.mock.calls[0][1] as (pointer: unknown) => void;
  const lastFrame = () => world.render.mock.lastCall![0] as WorldFrame;
  return { arena, surface, connection, world, receiveState, receiveEvents, click, lastFrame };
}

test('hits and the render clock reach the 3D world on the same scene clock', () => {
  const { arena, surface, connection, receiveState, receiveEvents, lastFrame } = worldScene();
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1000;
  receiveEvents([hit()]);
  surface.time.now = 1100;
  arena.update(9999, 16);
  expect(connection.onMessage.mock.calls[0][0]).toBe('events');
  expect(lastFrame().nowMs).toBe(1100);
  expect(lastFrame().selfId).toBe('eagle');
  expect(hitFlashFor(lastFrame().hits, 'boss', lastFrame().nowMs).intensity).toBeCloseTo(0.5, 6);
});

test('damage before the first synchronized snapshot is safe and retains its timestamp', () => {
  const { arena, surface, receiveState, receiveEvents, lastFrame } = worldScene();
  receiveState({ toJSON: () => ({}) });
  surface.time.now = 1000;
  receiveEvents([hit('boss', true)]);
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1140;
  arena.update(1140, 16);
  expect(hitFlashFor(lastFrame().hits, 'boss', 1140)).toMatchObject({ color: 0xffe066 });
  expect(hitFlashFor(lastFrame().hits, 'boss', 1140).intensity).toBeCloseTo(0.5, 6);
});

test('returning to the lobby clears the old attempt flash', () => {
  const { arena, surface, receiveState, receiveEvents, lastFrame } = worldScene();
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1000;
  receiveEvents([hit()]);
  receiveState({ toJSON: () => room([], { status: 'lobby' }) });
  receiveState({ toJSON: bossRoom });
  arena.update(1000, 16);
  expect(lastFrame().hits.size).toBe(0);
});

test('left click selects the unit whose projected body is under the pointer', () => {
  const { connection, receiveState, click } = worldScene();
  receiveState({ toJSON: bossRoom });
  click({ rightButtonDown: () => false, ...legacyProjection({ x: 2, y: 3 }, 1.5) });
  expect(connection.send).toHaveBeenCalledWith('target', { entityId: 'boss' });
  connection.send.mockClear();
  click({ rightButtonDown: () => false, ...legacyProjection({ x: -15, y: -15 }) });
  expect(connection.send).not.toHaveBeenCalled();
});

test('right click walks to the picked ground point and the marker reaches the world frame', () => {
  const { arena, connection, world, receiveState, click, lastFrame } = worldScene();
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })]) });
  click({ rightButtonDown: () => true, x: 64, y: -96 });
  expect(world.pick).toHaveBeenCalledWith({ x: 64, y: -96 });
  expect(connection.send).toHaveBeenCalledWith('moveTo', { x: 2, y: 3 });
  arena.update(0, 16);
  expect(lastFrame().destination).toEqual({ x: 2, y: 3 });
});

test('resizing reframes the world and shutting the scene down frees it', () => {
  const { surface, world } = worldScene();
  const resize = surface.scale.on.mock.calls.find(([name]) => name === 'resize')![1] as () => void;
  surface.scale.width = 800;
  resize();
  expect(world.resize).toHaveBeenLastCalledWith(800, 720);
  const shutdown = surface.events.once.mock.calls.find(([name]) => name === 'shutdown')![1] as () => void;
  shutdown();
  expect(world.dispose).toHaveBeenCalledOnce();
});

test('combat events become attack effects in the world frame until they expire or the lobby returns', () => {
  const { arena, surface, receiveState, receiveEvents, lastFrame } = worldScene();
  receiveState({ toJSON: bossRoom });
  surface.time.now = 1000;
  receiveEvents([hit()]);
  arena.update(1000, 16);
  expect(lastFrame().effects).toEqual([expect.objectContaining({ kind: 'projectile', sourceId: 'eagle', targetId: 'boss', startMs: 1000 })]);
  surface.time.now = 1300;
  arena.update(1300, 16);
  expect(lastFrame().effects).toEqual([]);
  receiveEvents([hit()]);
  receiveState({ toJSON: () => room([], { status: 'lobby' }) });
  receiveState({ toJSON: bossRoom });
  arena.update(1300, 16);
  expect(lastFrame().effects).toEqual([]);
});

function windowListener(name: string) {
  const calls = vi.mocked(window.addEventListener).mock.calls as unknown as [string, (event?: unknown) => void][];
  return calls.find(([type]) => type === name)![1];
}

test('WASD walks camera-relative, clears the click marker and stops on release or blur', () => {
  const { arena, connection, receiveState, click, lastFrame } = worldScene();
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })]) });
  click({ rightButtonDown: () => true, x: 64, y: -96 });
  const keydown = windowListener('keydown');
  const keyup = windowListener('keyup');
  const preventDefault = vi.fn();
  keydown({ code: 'KeyW', repeat: false, preventDefault });
  keydown({ code: 'KeyW', repeat: true, preventDefault });
  const moves = () => connection.send.mock.calls.filter(([type]) => type === 'move').map(([, payload]) => payload);
  expect(moves()).toHaveLength(1);
  expect(moves()[0].dx).toBeCloseTo(-Math.SQRT1_2, 6);
  expect(moves()[0].dy).toBeCloseTo(Math.SQRT1_2, 6);
  arena.update(0, 16);
  expect(lastFrame().destination).toBeUndefined();
  keyup({ code: 'KeyW' });
  expect(moves().at(-1)).toEqual({ dx: 0, dy: 0 });
  keydown({ code: 'KeyD', repeat: false, preventDefault });
  windowListener('blur')();
  expect(moves().at(-1)).toEqual({ dx: 0, dy: 0 });
  expect(preventDefault).not.toHaveBeenCalled();
});

test('WASD is ignored outside combat and the held keys reset when combat ends', () => {
  const { connection, receiveState } = worldScene();
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })], { status: 'lobby' }) });
  windowListener('keydown')({ code: 'KeyA', repeat: false, preventDefault: vi.fn() });
  expect(connection.send).not.toHaveBeenCalled();
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })]) });
  windowListener('keydown')({ code: 'KeyA', repeat: false, preventDefault: vi.fn() });
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })], { status: 'defeat' }) });
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })]) });
  windowListener('keydown')({ code: 'KeyA', repeat: false, preventDefault: vi.fn() });
  expect(connection.send.mock.calls.filter(([type]) => type === 'move')).toHaveLength(2);
});

test('shutting the scene down removes every keyboard and focus listener', () => {
  const { surface } = worldScene();
  const shutdown = surface.events.once.mock.calls.find(([name]) => name === 'shutdown')![1] as () => void;
  shutdown();
  const removed = vi.mocked(window.removeEventListener).mock.calls.map(([type]) => type);
  expect(removed).toEqual(['keydown', 'keyup', 'blur']);
});

test('Space dodges through the cast message without scrolling the page', () => {
  const { connection, receiveState } = worldScene();
  receiveState({ toJSON: () => room([entity({ id: 'eagle' })]) });
  const preventDefault = vi.fn();
  windowListener('keydown')({ code: 'Space', repeat: false, preventDefault });
  expect(connection.send).toHaveBeenCalledWith('cast', { abilityId: 'dodge' });
  expect(preventDefault).toHaveBeenCalledOnce();
});
