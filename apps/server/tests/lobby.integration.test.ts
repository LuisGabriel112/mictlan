import { afterEach, expect, test, vi } from 'vitest';
import { IntegrationServer } from './integration-fixture.js';

let server: IntegrationServer;

async function startServer(minimum?: string): Promise<IntegrationServer> {
  server = new IntegrationServer(minimum);
  await server.start();
  return server;
}

afterEach(async () => {
  await server?.stop();
});

test('C1: three clients join by code and synchronize combat with a complete party', async () => {
  await startServer();
  const jaguar = await server.create();
  const healer = await server.join(jaguar.state.code);
  const eagle = await server.join(jaguar.state.code);
  jaguar.send('ready', { classId: 'jaguar' });
  healer.send('ready', { classId: 'healer' });
  eagle.send('ready', { classId: 'eagle' });
  await vi.waitFor(() => expect(server.clients.map((client) => client.state.status)).toEqual(['combat', 'combat', 'combat']));
  const encounter = server.room(jaguar.roomId).encounter;
  expect(encounter?.config.players.map(({ id }) => id).sort()).toEqual(server.clients.map((client) => client.sessionId).sort());
  expect(encounter?.config.devMode).toBe(false);
  expect(encounter?.tick).toBe(0);
});

test('C2: second jaguar receives a private composition rejection and stays unready', async () => {
  await startServer();
  const jaguar = await server.create();
  const other = await server.join(jaguar.state.code);
  const observer = vi.fn();
  jaguar.onMessage('rejected', observer);
  jaguar.send('ready', { classId: 'jaguar' });
  await vi.waitFor(() => expect(other.state.players.get(jaguar.sessionId)?.ready).toBe(true));
  const rejected = new Promise<unknown>((resolve) => other.onMessage('rejected', resolve));
  other.send('ready', { classId: 'jaguar' });
  expect(await rejected).toEqual({ reason: 'composition' });
  expect(other.state.players.get(other.sessionId)).toMatchObject({ ready: false, classId: '' });
  expect(server.room(other.roomId).state.players.get(other.sessionId)?.ready).toBe(false);
  expect(observer).not.toHaveBeenCalled();
});

test('C3: MICTLAN_DEV_MIN_PLAYERS=1 allows one eagle to start', async () => {
  await startServer('1');
  const room = await server.create();
  room.send('ready', { classId: 'eagle' });
  await vi.waitFor(() => expect(room.state.status).toBe('combat'));
  expect(server.room(room.roomId).encounter?.config.devMode).toBe(true);
  expect(server.room(room.roomId).encounter?.entities.boss.health).toBe(24000);
  await expect(server.join(room.state.code)).rejects.toThrow();
});

test('C5: simultaneous rooms have distinct four-letter codes despite random collisions', async () => {
  await startServer();
  const [first, second] = await Promise.all([server.create(), server.create()]);
  expect(first.state.code).toMatch(/^[A-Z]{4}$/);
  expect(second.state.code).toMatch(/^[A-Z]{4}$/);
  expect(first.state.code).not.toBe(second.state.code);
  const joined = await server.join(second.state.code);
  expect(joined.roomId).toBe(second.roomId);
});

test.each([null, [], {}, { classId: 7 }, { classId: 'invalid' }])('malformed ready %j is rejected without exceptions', async (payload) => {
  await startServer();
  const room = await server.create();
  const rejected = new Promise<unknown>((resolve) => room.onMessage('rejected', resolve));
  room.send('ready', payload);
  expect(await rejected).toEqual({ reason: 'invalid_class' });
  expect(room.state.players.get(room.sessionId)).toMatchObject({ ready: false, classId: '' });
  expect(server.room(room.roomId).encounter).toBeUndefined();
});

test('client options cannot override the default minimum or activate devMode', async () => {
  await startServer('invalid');
  const room = await server.create({ minPlayers: 1, devMode: true });
  room.send('ready', { classId: 'eagle' });
  await vi.waitFor(() => expect(room.state.players.get(room.sessionId)?.ready).toBe(true));
  expect(room.state.status).toBe('lobby');
  expect(server.room(room.roomId).encounter).toBeUndefined();
});

test('five clients fit in the lobby and a sixth cannot join', async () => {
  await startServer();
  const room = await server.create();
  for (let index = 1; index < 5; index += 1) await server.join(room.state.code);
  await vi.waitFor(() => expect(room.state.players.size).toBe(5));
  await expect(server.join(room.state.code)).rejects.toThrow();
});

test('leaving a lobby removes the synchronized player', async () => {
  await startServer();
  const room = await server.create();
  const departing = await server.join(room.state.code);
  await departing.leave();
  server.clients.pop();
  await vi.waitFor(() => expect(room.state.players.size).toBe(1));
  expect(room.state.players.has(departing.sessionId)).toBe(false);
});
