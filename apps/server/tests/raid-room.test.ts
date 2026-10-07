import { expect, test, vi } from 'vitest';
import { createEncounter, removePlayer, step } from '@mictlan/core';
import { RaidRoom, createRaidRoom } from '../src/rooms/RaidRoom.js';
import { LobbyState, LobbyPlayerState } from '../src/schema/LobbyState.js';

function roomFixture(minPlayers = 3) {
  const dependencies = {
    minPlayers, codes: { reserve: vi.fn(() => 'ABCD'), release: vi.fn() },
    createEncounter: vi.fn(createEncounter), nextSeed: vi.fn(() => 42), step, removePlayer,
  };
  const room = new RaidRoom(dependencies);
  vi.spyOn(room, 'lock').mockResolvedValue();
  vi.spyOn(room, 'setTimestep').mockImplementation(() => undefined);
  return { room, dependencies };
}

function lobbyClient(sessionId: string) {
  return { sessionId, send: vi.fn() };
}

test('schema defaults create independent lobby maps and unready players', () => {
  const state = new LobbyState();
  const player = new LobbyPlayerState({ id: 'session' });
  expect(player).toMatchObject({ id: 'session', classId: '', ready: false });
  expect(state).toMatchObject({ status: 'lobby', code: '' });
  state.players.set(player.id, player);
  expect(new LobbyState().players.size).toBe(0);
});

test('onCreate assigns the reserved roomId, limits seats and registers ready', () => {
  const { room, dependencies } = roomFixture();
  const subscribe = vi.spyOn(room, 'onMessage');
  room.onCreate();
  expect(room.maxClients).toBe(5);
  expect(room.roomId).toBe('ABCD');
  expect(room.state.code).toBe('ABCD');
  expect(dependencies.codes.reserve).toHaveBeenCalledOnce();
  expect(subscribe).toHaveBeenCalledWith('ready', expect.any(Function));
});

test('onJoin stores session id; onLeave removes a lobby player', async () => {
  const { room } = roomFixture();
  const client = lobbyClient('session');
  room.onJoin(client);
  expect(room.state.players.get('session')).toMatchObject({ id: 'session', classId: '', ready: false });
  await room.onLeave(client);
  expect(room.state.players.size).toBe(0);
  expect(room.encounter).toBeUndefined();
});

test('receiveReady rejects privately without changing the player', async () => {
  const { room } = roomFixture();
  const tank = lobbyClient('tank');
  const other = lobbyClient('other');
  room.onJoin(tank);
  room.onJoin(other);
  await room.receiveReady(tank, { classId: 'jaguar' });
  await room.receiveReady(other, { classId: 'jaguar' });
  expect(other.send).toHaveBeenCalledWith('rejected', { reason: 'composition' });
  expect(tank.send).not.toHaveBeenCalled();
  expect(room.state.players.get('other')).toMatchObject({ classId: '', ready: false });
});

test('receiveReady ignores missing players and never calls core for invalid payloads', async () => {
  const { room, dependencies } = roomFixture(1);
  const client = lobbyClient('unknown');
  await room.receiveReady(client, { classId: 'eagle' });
  room.onJoin(client);
  await room.receiveReady(client, null);
  expect(client.send).toHaveBeenCalledExactlyOnceWith('rejected', { reason: 'invalid_class' });
  expect(dependencies.createEncounter).not.toHaveBeenCalled();
});

test('tryStartEncounter stores exactly one seeded encounter and locks combat', async () => {
  const { room, dependencies } = roomFixture(1);
  const client = lobbyClient('session');
  room.onJoin(client);
  await room.receiveReady(client, { classId: 'eagle' });
  const encounter = room.encounter;
  await room.receiveReady(client, { classId: 'healer' });
  expect(dependencies.createEncounter).toHaveBeenCalledExactlyOnceWith({
    players: [{ id: 'session', classId: 'eagle' }], devMode: true,
  }, 42);
  expect(dependencies.nextSeed).toHaveBeenCalledOnce();
  expect(room.encounter).toBe(encounter);
  expect(room.state.status).toBe('combat');
  expect(room.lock).toHaveBeenCalledOnce();
  expect(room.state.players.get('session')?.classId).toBe('eagle');
});

test('onLeave keeps a complete ready party in lobby when the last unready player leaves', async () => {
  const { room } = roomFixture(1);
  const ready = lobbyClient('ready');
  const waiting = lobbyClient('waiting');
  room.onJoin(ready);
  room.onJoin(waiting);
  await room.receiveReady(ready, { classId: 'eagle' });
  expect(room.state.status).toBe('lobby');
  await room.onLeave(waiting);
  expect(room.state.status).toBe('lobby');
});

test('combat rejects late joins and kills disconnected players', async () => {
  const { room } = roomFixture(1);
  const client = lobbyClient('session');
  room.onJoin(client);
  await room.receiveReady(client, { classId: 'eagle' });
  expect(() => room.onJoin(lobbyClient('late'))).toThrow('La sala ya inició el combate.');
  await room.onLeave(client);
  expect(room.encounter?.entities.session.health).toBe(0);
});

test('onDispose releases the code and createRaidRoom injects server dependencies', () => {
  const { dependencies } = roomFixture();
  const ConfiguredRaidRoom = createRaidRoom(dependencies);
  const room = new ConfiguredRaidRoom();
  room.onCreate();
  room.onDispose();
  expect(dependencies.codes.release).toHaveBeenCalledExactlyOnceWith('ABCD');
});
