import { expect, test, vi } from 'vitest';
import { BOSS, createEncounter, removePlayer, step, type CombatEvent } from '@mictlan/core';
import { RaidRoom } from '../src/rooms/RaidRoom.js';
import * as synchronization from '../src/schema/sync.js';

async function synchronizedRoom() {
  const advance = vi.fn(step);
  const room = new RaidRoom({ minPlayers: 1, codes: { reserve: () => 'SYNC', release: vi.fn() },
    createEncounter, nextSeed: () => 42, step: advance, removePlayer });
  vi.spyOn(room, 'lock').mockResolvedValue();
  const timestep = vi.spyOn(room, 'setTimestep').mockImplementation(() => undefined);
  const broadcast = vi.spyOn(room, 'broadcast').mockImplementation(() => undefined);
  room.onJoin({ sessionId: 'eagle' });
  await room.receiveReady({ sessionId: 'eagle', send: vi.fn() }, { classId: 'eagle' });
  return { room, advance, broadcast, tick: (delta: number) => timestep.mock.calls[0][0]!(delta) };
}

test('starting combat synchronizes core before the first timestep', async () => {
  const { room, advance, broadcast } = await synchronizedRoom();
  expect(room.state.entities.get('eagle')).toMatchObject({ id: 'eagle', health: 750, x: 0, y: -15 });
  expect(room.state).toMatchObject({ status: 'combat', tick: 0, elapsedTicks: 0, phase: 1, safeRadiusMeters: 20 });
  expect(room.state.entities.get('boss')?.health).toBe(BOSS.maxHealthByPlayerCount[3]);
  expect(advance).not.toHaveBeenCalled();
  expect(broadcast).not.toHaveBeenCalled();
});

test('advanceCombat skips synchronization below one tick and synchronizes a silent step', async () => {
  const { room, advance, broadcast, tick } = await synchronizedRoom();
  const synchronize = vi.spyOn(synchronization, 'syncEncounter');
  tick(49);
  expect(advance).not.toHaveBeenCalled();
  expect(synchronize).not.toHaveBeenCalled();
  tick(1);
  expect(synchronize).toHaveBeenCalledExactlyOnceWith(room.state, room.encounter);
  expect(room.state.tick).toBe(1);
  expect(broadcast).not.toHaveBeenCalled();
  synchronize.mockRestore();
});

test('advanceCombat broadcasts all step events once in order and synchronizes only the final state', async () => {
  const { room, advance, broadcast, tick } = await synchronizedRoom();
  const synchronize = vi.spyOn(synchronization, 'syncEncounter');
  const events: CombatEvent[] = [
    { type: 'damage', tick: 1, sourceId: 'eagle', abilityId: 'quickShot', targetId: 'boss', amount: 70, critical: false },
    { type: 'phaseChanged', tick: 2, phase: 2 },
  ];
  advance.mockReturnValueOnce({ state: { ...room.encounter!, tick: 1 }, events: [events[0]] });
  advance.mockReturnValueOnce({ state: { ...room.encounter!, tick: 2, phase: 2 }, events: [events[1]] });
  tick(100);
  expect(broadcast).toHaveBeenCalledExactlyOnceWith('events', events);
  expect(synchronize).toHaveBeenCalledExactlyOnceWith(room.state, room.encounter);
  expect(room.state).toMatchObject({ tick: 2, phase: 2 });
  synchronize.mockRestore();
});

test('the terminal step synchronizes its final health and broadcasts its final events', async () => {
  const { room, advance, broadcast, tick } = await synchronizedRoom();
  const encounter = room.encounter!;
  const events: CombatEvent[] = [{ type: 'encounterEnded', tick: 1, outcome: 'victory' }];
  advance.mockReturnValueOnce({ state: { ...encounter, tick: 1, status: 'victory',
    entities: { ...encounter.entities, boss: { ...encounter.entities.boss, health: 0 } } }, events });
  tick(50);
  expect(room.state).toMatchObject({ status: 'victory', tick: 1 });
  expect(room.state.entities.get('boss')?.health).toBe(0);
  expect(broadcast).toHaveBeenCalledExactlyOnceWith('events', events);
});
