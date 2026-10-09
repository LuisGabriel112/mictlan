import { afterEach, expect, test, vi } from 'vitest';
import { ArenaScene } from '../src/scene/ArenaScene';
import { sceneFixture } from './phaser-fixtures';
import { fakeWorld } from './world-fixtures';
import { lobbyConnection } from './lobby-fixtures';
import { room, entity } from './fixtures';
import type { RoomSnapshot } from '../src/snapshot';

vi.mock('phaser', async () => {
  const { sceneFixture: makeScene } = await import('./phaser-fixtures');
  return { Scene: class { constructor() { Object.assign(this, makeScene()); } }, Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
});

afterEach(() => vi.unstubAllGlobals());

function combatControls(initial?: RoomSnapshot) {
  const transport = lobbyConnection(initial);
  const keyboard = vi.fn();
  vi.stubGlobal('window', { addEventListener: keyboard, removeEventListener: vi.fn() });
  const world = fakeWorld();
  const arena = new ArenaScene(transport.connection, world);
  arena.create();
  const surface = arena as unknown as ReturnType<typeof sceneFixture>;
  const key = keyboard.mock.calls[0][1] as (event: unknown) => void;
  const click = surface.input.on.mock.calls[0][1] as (pointer: unknown) => void;
  return { ...transport, arena, surface, key, click, world };
}

test.each(['lobby', 'victory', 'defeat'] as const)('combat input is silent during %s and leaves Tab to the form', (status) => {
  const fixture = combatControls(room([], { status }));
  const preventDefault = vi.fn();
  fixture.key({ code: 'Tab', preventDefault });
  fixture.key({ code: 'Digit1', preventDefault });
  fixture.click({ rightButtonDown: () => true, x: 10, y: 10 });
  expect(fixture.connection.send).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
});

test('arena reads a state that arrived before Phaser boot and still accepts combat controls', () => {
  const fixture = combatControls(room([entity({ id: 'self' })]));
  const preventDefault = vi.fn();
  fixture.key({ code: 'Tab', preventDefault });
  fixture.key({ code: 'KeyX', preventDefault });
  fixture.click({ rightButtonDown: () => true, x: 32, y: 32 });
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(fixture.connection.send).toHaveBeenCalledWith('stop', {});
  expect(fixture.connection.send).toHaveBeenCalledWith('moveTo', { x: 1, y: -1 });
  fixture.arena.update(0, 0);
  expect(fixture.world.render).toHaveBeenCalledOnce();
  expect(fixture.world.resize).toHaveBeenCalledWith(1280, 720);
});

test('controls wait for the first snapshot and ignore repeated combat keys', () => {
  const fixture = combatControls();
  const preventDefault = vi.fn();
  fixture.key({ code: 'Tab', preventDefault });
  fixture.click({ rightButtonDown: () => true, x: 0, y: 0 });
  expect(preventDefault).not.toHaveBeenCalled();
  fixture.states[0]({ toJSON: () => room([entity({ id: 'self' })]) });
  fixture.key({ code: 'KeyX', repeat: true, preventDefault });
  expect(fixture.connection.send).not.toHaveBeenCalled();
});

test('arena boots on an unsynchronized state and draws once the full snapshot arrives', () => {
  const fixture = combatControls({} as RoomSnapshot);
  fixture.arena.update(0, 0);
  expect(fixture.world.render).not.toHaveBeenCalled();
  fixture.states.forEach((callback) => callback({ toJSON: () => ({}) }));
  fixture.arena.update(0, 0);
  expect(fixture.world.render).not.toHaveBeenCalled();
  fixture.states.forEach((callback) => callback({ toJSON: () => room([entity({ id: 'self' })]) }));
  fixture.arena.update(0, 0);
  expect(fixture.world.render).toHaveBeenCalledOnce();
});
