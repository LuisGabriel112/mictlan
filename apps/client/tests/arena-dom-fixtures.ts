import { vi } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { ArenaScene } from '../src/scene/ArenaScene';
import type { RoomSnapshot } from '../src/snapshot';
import { lobbyConnection } from './lobby-fixtures';
import { fakeBrowser, hudDocument } from './hud-dom-fixtures';
import { fakeWorld } from './world-fixtures';

export function arenaFixture(initial?: RoomSnapshot) {
  const dom = hudDocument();
  const browser = fakeBrowser();
  const transport = lobbyConnection(initial);
  const world = fakeWorld();
  const createWorld = vi.fn(() => world);
  let clock = 0;
  Object.assign(dom.host, { getBoundingClientRect: () => ({ left: 0, top: 0 }) });
  const arena = new ArenaScene(transport.connection, createWorld, { document: dom.document,
    window: browser.window, host: dom.parent, now: () => clock });
  arena.create();
  return { ...dom, ...browser, ...transport, world, arena, createWorld,
    setTime: (time: number) => { clock = time; },
    state: (snapshot: unknown) => transport.states.forEach((callback) => callback({ toJSON: () => snapshot })),
    events: (events: CombatEvent[]) => transport.messages.get('events')!(events) };
}

export function press(fixture: ReturnType<typeof arenaFixture>, code: string, repeat = false, shiftKey = false) {
  const event = { code, repeat, shiftKey, preventDefault: vi.fn() };
  fixture.listeners.get('keydown')!(event);
  return event;
}

export function click(fixture: ReturnType<typeof arenaFixture>, x: number, y: number, button = 0): void {
  fixture.host.listeners.get('pointerdown')!({ clientX: x, clientY: y, button, target: fixture.host });
}
