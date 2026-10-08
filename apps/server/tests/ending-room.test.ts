import { expect, test } from 'vitest';
import { BOSS, COMBAT_RULES } from '@mictlan/core';
import { endingRoom, joinPlayer, readyPlayer } from './ending-room-fixture.js';

test.each(['victory', 'defeat'] as const)('terminal %s schedules exactly one reset using the room clock', async (status) => {
  const { room, dependencies, timestep, timeout, unlock } = endingRoom();
  await readyPlayer(room);
  dependencies.step.mockReturnValueOnce({ state: { ...room.encounter!, status, tick: 1 }, events: [] });
  const advance = timestep.mock.calls[0][0]!;
  advance(50);
  advance(500);
  expect(room.state.status).toBe(status);
  expect(dependencies.step).toHaveBeenCalledOnce();
  expect(timeout).toHaveBeenCalledExactlyOnceWith(expect.any(Function), BOSS.returnToLobbyDelayTicks * COMBAT_RULES.tickDurationMs);
  expect(timeout.mock.calls[0][1]).toBe(5000);
  expect(unlock).not.toHaveBeenCalled();
  expect(timestep).toHaveBeenLastCalledWith(expect.any(Function), 50);
  timestep.mock.calls[1][0]!(5000);
  expect(dependencies.step).toHaveBeenCalledOnce();
});

test('the scheduled reset discards the session, unlocks and allows a fresh encounter', async () => {
  const { room, dependencies, timestep, timeout, unlock } = endingRoom();
  const client = await readyPlayer(room);
  dependencies.step.mockReturnValueOnce({ state: { ...room.encounter!, status: 'defeat', tick: 1 }, events: [] });
  const advance = timestep.mock.calls[0][0]!;
  advance(50);
  await timeout.mock.calls[0][0]();
  expect(room.encounter).toBeUndefined();
  expect(room.state).toMatchObject({ status: 'lobby', tick: 0 });
  expect(room.state.players.get('eagle')).toMatchObject({ classId: 'eagle', ready: false });
  expect(unlock).toHaveBeenCalledOnce();
  advance(50);
  expect(dependencies.step).toHaveBeenCalledOnce();
  await room.receiveReady(client, { classId: 'eagle' });
  expect(dependencies.createEncounter).toHaveBeenCalledTimes(2);
  expect(room.encounter).toMatchObject({ status: 'combat', tick: 0 });
  expect(room.encounter?.entities.eagle.health).toBe(750);
});

test('initialBossHealth changes only the new session without mutating core creation', async () => {
  const { room, dependencies } = endingRoom(1);
  await readyPlayer(room);
  expect(room.encounter?.entities.boss).toMatchObject({ health: 1, maxHealth: BOSS.maxHealthByPlayerCount[3] });
  expect(dependencies.createEncounter.mock.results[0].value.entities.boss.health).toBe(BOSS.maxHealthByPlayerCount[3]);
});

test('without test health the created encounter is used unchanged', async () => {
  const { room, dependencies } = endingRoom();
  await readyPlayer(room);
  expect(room.encounter).toBe(dependencies.createEncounter.mock.results[0].value);
});

test('combat departure synchronizes death, broadcasts once and removes the lobby entry', async () => {
  const { room, dependencies, broadcast } = endingRoom();
  const client = await readyPlayer(room);
  await room.onLeave(client);
  expect(room.state.players.has(client.sessionId)).toBe(false);
  expect(room.encounter?.entities.eagle.health).toBe(0);
  expect(room.state.entities.get('eagle')?.health).toBe(0);
  expect(broadcast).toHaveBeenCalledExactlyOnceWith('events', [
    { type: 'death', entityId: 'eagle', sourceId: 'eagle', abilityId: 'disconnect', tick: 0 },
  ]);
  expect(dependencies.removePlayer).toHaveBeenCalledOnce();
  await room.onLeave(client);
  await room.onLeave({ sessionId: 'unknown' });
  expect(broadcast).toHaveBeenCalledOnce();
});

test('departures during the result screen leave the encounter frozen', async () => {
  const { room, dependencies, timestep, broadcast } = endingRoom();
  const client = await readyPlayer(room);
  dependencies.step.mockReturnValueOnce({ state: { ...room.encounter!, status: 'victory', tick: 1 }, events: [] });
  timestep.mock.calls[0][0]!(50);
  const encounter = room.encounter;
  await room.onLeave(client);
  expect(room.state.players.size).toBe(0);
  expect(room.encounter).toBe(encounter);
  expect(dependencies.removePlayer).not.toHaveBeenCalled();
  expect(broadcast).not.toHaveBeenCalled();
});

test('C5: lobby departure requires another ready even when the remaining party is ready', async () => {
  const { room, dependencies } = endingRoom();
  const waiting = joinPlayer(room, 'waiting');
  const ready = await readyPlayer(room);
  await room.onLeave(waiting);
  expect(room.state.status).toBe('lobby');
  expect(room.state.players.size).toBe(1);
  expect(dependencies.createEncounter).not.toHaveBeenCalled();
  await room.receiveReady(ready, { classId: 'eagle' });
  expect(room.state.status).toBe('combat');
});

test('a lobby departure frees the chosen role for another player', async () => {
  const { room } = endingRoom();
  const waiting = joinPlayer(room, 'waiting');
  const tank = await readyPlayer(room, 'tank', 'jaguar');
  await room.onLeave(tank);
  await room.receiveReady(waiting, { classId: 'jaguar' });
  expect(waiting.send).not.toHaveBeenCalled();
  expect(room.state.players.get('waiting')?.classId).toBe('jaguar');
});
