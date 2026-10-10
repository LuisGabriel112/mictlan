import { expect, test, vi } from 'vitest';
import { room, entity } from './fixtures';
import { arenaFixture, press, click } from './arena-dom-fixtures';

test.each(['lobby', 'victory', 'defeat'] as const)('input is silent during %s and leaves Tab to the form', (status) => {
  const fixture = arenaFixture(room([], { status }));
  expect(press(fixture, 'Tab').preventDefault).not.toHaveBeenCalled();
  press(fixture, 'Digit1'); press(fixture, 'KeyW');
  click(fixture, 10, 10, 2);
  expect(fixture.connection.send).not.toHaveBeenCalled();
});

test('arena reads preexisting state, sizes the world and accepts native combat input', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  expect(press(fixture, 'Tab').preventDefault).toHaveBeenCalledOnce();
  press(fixture, 'KeyX'); click(fixture, 32, 32, 2);
  expect(fixture.connection.send).toHaveBeenCalledWith('stop', {});
  expect(fixture.connection.send).toHaveBeenCalledWith('moveTo', { x: 1, y: -1 });
  fixture.arena.update(0, 0);
  expect(fixture.world.render).toHaveBeenCalledOnce();
  expect(fixture.world.resize).toHaveBeenCalledWith(1280, 720);
});

test('unsynchronized states and repeated combat actions are ignored', () => {
  const fixture = arenaFixture();
  press(fixture, 'Tab'); click(fixture, 0, 0, 2); fixture.state({}); fixture.arena.update(0, 0);
  expect(fixture.world.render).not.toHaveBeenCalled();
  expect(fixture.connection.send).not.toHaveBeenCalled();
  fixture.state(room([entity({ id: 'self' })])); press(fixture, 'KeyX', true);
  fixture.arena.update(0, 0);
  expect(fixture.world.render).toHaveBeenCalledOnce();
  expect(fixture.connection.send).not.toHaveBeenCalled();
});

test('RAF schedules once, uses the injected clock and releases/recreates the world at the lobby', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  fixture.state(room([entity({ id: 'self' })]));
  expect(fixture.browser.requestAnimationFrame).toHaveBeenCalledOnce();
  fixture.setTime(100); fixture.browser.requestAnimationFrame.mock.calls[0][0](9999);
  expect(fixture.world.render.mock.lastCall![0].nowMs).toBe(100);
  fixture.state(room([], { status: 'lobby' }));
  expect(fixture.world.dispose).toHaveBeenCalledOnce();
  expect(fixture.browser.cancelAnimationFrame).toHaveBeenCalledWith(7);
  fixture.state(room([entity({ id: 'self' })]));
  expect(fixture.createWorld).toHaveBeenCalledTimes(2);
  fixture.arena.dispose(); fixture.arena.dispose();
  expect(fixture.world.dispose).toHaveBeenCalledTimes(2);
});

test('disposal removes listeners, ignores late messages and removes the HUD', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  fixture.arena.dispose(); fixture.state(room([entity({ id: 'self' })])); fixture.events([]);
  fixture.arena.update(0, 0);
  expect(fixture.world.render).not.toHaveBeenCalled();
  expect(fixture.browser.removeEventListener.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['keydown', 'keyup', 'blur', 'resize']));
  expect(fixture.host.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  expect(fixture.find('arena-hud')[0].remove).toHaveBeenCalledOnce();
});

test('resize reframes the world and context menu is suppressed over the game', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  fixture.browser.innerWidth = 800; fixture.listeners.get('resize')!({});
  expect(fixture.world.resize).toHaveBeenLastCalledWith(800, 720);
  const preventDefault = vi.fn(); fixture.host.listeners.get('contextmenu')!({ preventDefault });
  expect(preventDefault).toHaveBeenCalledOnce();
});
