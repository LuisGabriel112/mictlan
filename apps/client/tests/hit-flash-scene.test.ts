import { expect, test, vi } from 'vitest';
import { hitFlashFor } from '../src/hit-flash';
import { entity, room } from './fixtures';
import { bossRoom, hit } from './hit-flash-fixtures';
import { arenaFixture, click, press } from './arena-dom-fixtures';
import { legacyProjection } from './world-fixtures';

test('hits, effects and render use one injected clock, including pre-state damage', () => {
  const fixture = arenaFixture(); fixture.state({}); fixture.setTime(1000); fixture.events([hit('boss', true)]);
  fixture.state(bossRoom()); fixture.arena.update(1140, 16);
  const frame = fixture.world.render.mock.lastCall![0];
  expect(hitFlashFor(frame.hits, 'boss', frame.nowMs)).toMatchObject({ color: 0xffe066, intensity: 0.5 });
  fixture.events([hit()]); fixture.arena.update(1100, 16);
  expect(fixture.world.render.mock.lastCall![0].effects).toEqual([expect.objectContaining({ kind: 'projectile', startMs: 1000 })]);
  fixture.arena.update(1300, 16);
  expect(fixture.world.render.mock.lastCall![0].effects).toEqual([]);
});

test('lobby clears flashes and effects from the previous attempt', () => {
  const fixture = arenaFixture(bossRoom()); fixture.events([hit()]);
  fixture.state(room([], { status: 'lobby' })); fixture.state(bossRoom()); fixture.arena.update(0, 0);
  expect(fixture.world.render.mock.lastCall![0].hits.size).toBe(0);
  expect(fixture.world.render.mock.lastCall![0].effects).toEqual([]);
});

test('left click selects projected bodies and gives group frames priority', () => {
  const fixture = arenaFixture(bossRoom());
  const point = legacyProjection({ x: 2, y: 3 }, 1.5); click(fixture, point.x, point.y);
  expect(fixture.connection.send).toHaveBeenCalledWith('target', { entityId: 'boss' });
  vi.mocked(fixture.connection.send).mockClear(); click(fixture, 900, 200);
  expect(fixture.connection.send).not.toHaveBeenCalled();
  fixture.state(room([entity({ id: 'self' })])); click(fixture, 20, 160);
  expect(fixture.connection.send).toHaveBeenCalledWith('target', { entityId: 'self' });
});

test('right click uses container-relative ground coordinates and forwards its destination', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  Object.assign(fixture.host, { getBoundingClientRect: () => ({ left: 10, top: 20 }) });
  click(fixture, 74, -76, 2); fixture.arena.update(0, 16);
  expect(fixture.world.pick).toHaveBeenCalledWith({ x: 64, y: -96 });
  expect(fixture.connection.send).toHaveBeenCalledWith('moveTo', { x: 2, y: 3 });
  expect(fixture.world.render.mock.lastCall![0].destination).toEqual({ x: 2, y: 3 });
});

test('WASD clears the marker, avoids duplicate moves and stops on keyup or blur', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })])); click(fixture, 64, -96, 2);
  press(fixture, 'KeyW'); press(fixture, 'KeyW', true); fixture.arena.update(0, 16);
  expect(fixture.connection.send).toHaveBeenCalledWith('move', { dx: -Math.SQRT1_2, dy: Math.SQRT1_2 });
  expect(fixture.world.render.mock.lastCall![0].destination).toBeUndefined();
  fixture.listeners.get('keyup')!({ code: 'KeyW' });
  expect(fixture.connection.send).toHaveBeenLastCalledWith('move', { dx: 0, dy: 0 });
  press(fixture, 'KeyD'); fixture.listeners.get('blur')!({});
  expect(fixture.connection.send).toHaveBeenLastCalledWith('move', { dx: 0, dy: 0 });
});

test('keys reset when combat ends, X stops, and Space dodges without scrolling', () => {
  const fixture = arenaFixture(room([entity({ id: 'self' })]));
  press(fixture, 'KeyA'); fixture.state(room([], { status: 'defeat' }));
  fixture.state(room([entity({ id: 'self' })])); press(fixture, 'KeyA');
  expect(vi.mocked(fixture.connection.send).mock.calls.filter(([type]) => type === 'move')).toHaveLength(2);
  press(fixture, 'KeyX'); fixture.listeners.get('keyup')!({ code: 'KeyA' });
  expect(fixture.connection.send).toHaveBeenLastCalledWith('stop', {});
  expect(press(fixture, 'Space').preventDefault).toHaveBeenCalledOnce();
  expect(fixture.connection.send).toHaveBeenLastCalledWith('cast', { abilityId: 'dodge' });
});

test('ability keys, ally shortcuts, unknown keys and casts preserve input behavior', () => {
  const fixture = arenaFixture(room([entity({ id: 'self', classId: 'eagle' })]));
  click(fixture, 64, -96, 2); press(fixture, 'Digit1'); fixture.arena.update(0, 16);
  expect(fixture.connection.send).toHaveBeenLastCalledWith('cast', { abilityId: 'arrow' });
  expect(fixture.world.render.mock.lastCall![0].destination).toBeUndefined();
  press(fixture, 'Numpad2'); expect(fixture.connection.send).toHaveBeenLastCalledWith('cast', { abilityId: 'quickShot' });
  expect(press(fixture, 'F1').preventDefault).toHaveBeenCalledOnce();
  expect(fixture.connection.send).toHaveBeenLastCalledWith('target', { entityId: 'self' });
  press(fixture, 'Digit1', false, true); press(fixture, 'KeyZ'); press(fixture, 'F5');
  expect(fixture.connection.send).toHaveBeenLastCalledWith('target', { entityId: 'self' });
});

test('empty self, middle click and focused form controls never send accidental commands', () => {
  const fixture = arenaFixture(room([])); press(fixture, 'Digit1'); click(fixture, 20, 20, 1);
  fixture.listeners.get('keydown')!({ code: 'KeyW', target: { tagName: 'INPUT' } });
  expect(fixture.connection.send).not.toHaveBeenCalled();
});
