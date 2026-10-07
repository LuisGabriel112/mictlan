import { vi } from 'vitest';
import { createEncounter, removePlayer, step, type ClassId } from '@mictlan/core';
import { RaidRoom } from '../src/rooms/RaidRoom.js';

export function endingRoom(initialBossHealth?: number) {
  const dependencies = { minPlayers: 1, codes: { reserve: () => 'ENDR', release: vi.fn() },
    createEncounter: vi.fn(createEncounter), nextSeed: () => 42, step: vi.fn(step),
    removePlayer: vi.fn(removePlayer), initialBossHealth };
  const room = new RaidRoom(dependencies);
  vi.spyOn(room, 'lock').mockResolvedValue();
  const unlock = vi.spyOn(room, 'unlock').mockResolvedValue();
  const timestep = vi.spyOn(room, 'setTimestep').mockImplementation(() => undefined);
  const broadcast = vi.spyOn(room, 'broadcast').mockImplementation(() => undefined);
  const timeout = vi.spyOn(room.clock, 'setTimeout');
  room.onCreate();
  return { room, dependencies, unlock, timestep, broadcast, timeout };
}

export function joinPlayer(room: RaidRoom, sessionId: string) {
  const client = { sessionId, send: vi.fn() };
  room.onJoin(client);
  return client;
}

export async function readyPlayer(room: RaidRoom, sessionId = 'eagle', classId: ClassId = 'eagle') {
  const client = joinPlayer(room, sessionId);
  await room.receiveReady(client, { classId });
  return client;
}
