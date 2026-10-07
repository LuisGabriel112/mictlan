import { expect, test, vi } from 'vitest';
import { createEncounter, step } from '@mictlan/core';
import { RaidRoom } from '../src/rooms/RaidRoom.js';

function combatRoom(critChance?: number) {
  const dependencies = {
    minPlayers: 1, codes: { reserve: vi.fn(() => 'ABCD'), release: vi.fn() },
    createEncounter: vi.fn(createEncounter), nextSeed: vi.fn(() => 42), step: vi.fn(step), critChance,
  };
  const room = new RaidRoom(dependencies);
  vi.spyOn(room, 'lock').mockResolvedValue();
  const timestep = vi.spyOn(room, 'setTimestep').mockImplementation(() => undefined);
  const handlers = new Map<string, (client: { sessionId: string }, payload: unknown) => unknown>();
  vi.spyOn(room, 'onMessage').mockImplementation(((type: string, handler: never) => handlers.set(type, handler)) as never);
  room.onCreate();
  return { room, dependencies, timestep, handlers };
}

async function startEagle(critChance?: number) {
  const fixture = combatRoom(critChance);
  fixture.room.onJoin({ sessionId: 'p1' });
  await fixture.room.receiveReady({ sessionId: 'p1', send: vi.fn() }, { classId: 'eagle' });
  return fixture;
}

test('onCreate registers move, target and cast handlers', () => {
  const { handlers } = combatRoom();
  expect([...handlers.keys()].sort()).toEqual(['cast', 'move', 'ready', 'target']);
});

test('combat inputs before the encounter starts are ignored without errors', () => {
  const { handlers, dependencies } = combatRoom();
  expect(() => handlers.get('move')?.({ sessionId: 'p1' }, { dx: 1, dy: 0 })).not.toThrow();
  expect(dependencies.step).not.toHaveBeenCalled();
});

test('starting combat runs the loop at the core tick with the injected crit chance', async () => {
  const { room, timestep, dependencies } = await startEagle(0);
  expect(timestep).toHaveBeenCalledWith(expect.any(Function), 50);
  expect(dependencies.createEncounter.mock.calls[0][0]).toMatchObject({ critChance: 0, devMode: true });
  expect(room.encounter?.critChance).toBe(0);
});

test('without an injected crit chance core keeps its default', async () => {
  const { dependencies } = await startEagle();
  expect(dependencies.createEncounter.mock.calls[0][0]).not.toHaveProperty('critChance');
});

test('each loop callback steps the encounter and routes inputs to it', async () => {
  const { room, timestep, handlers, dependencies } = await startEagle(0);
  handlers.get('move')?.({ sessionId: 'p1' }, { dx: 0, dy: 2 });
  timestep.mock.calls[0][0]?.(50);
  expect(dependencies.step.mock.calls[0][1]).toEqual([{ playerId: 'p1', type: 'move', dx: 0, dy: 1 }]);
  expect(room.encounter?.tick).toBe(1);
});

test('the loop stops and the lobby status mirrors the outcome when combat ends', async () => {
  const { room, timestep, dependencies } = await startEagle(0);
  const ended = { ...room.encounter!, tick: room.encounter!.tick + 1, status: 'defeat' as const };
  dependencies.step.mockReturnValueOnce({ state: ended, events: [] });
  timestep.mock.calls[0][0]?.(50);
  expect(room.state.status).toBe('defeat');
  expect(timestep).toHaveBeenLastCalledWith();
});
