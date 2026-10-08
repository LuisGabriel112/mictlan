import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, type Room } from '@colyseus/sdk';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { startProductionServer } from '../src/production-server.js';
import type { LobbyState } from '../src/schema/LobbyState.js';

let directory: string;
let hosted: Awaited<ReturnType<typeof startProductionServer>>;
let origin: string;
const connections: Room<unknown, LobbyState>[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'mictlan-t41-'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), '<html>MICTLÁN</html>');
  await writeFile(join(directory, 'assets', 'app.js'), 'export const ready = true;');
  hosted = await startProductionServer({ PORT: '0', MICTLAN_DEV_MIN_PLAYERS: '1' }, directory);
  const address = hosted.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP port');
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await Promise.all(connections.map((room) => room.leave()));
  await hosted?.gameServer.gracefullyShutdown(false);
  await rm(directory, { recursive: true, force: true });
});

test.each(['/', '/index.html', '/sala/ABCD?code=ABCD'])('serves index.html at %s', async (path) => {
  const response = await fetch(`${origin}${path}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(await response.text()).toBe('<html>MICTLÁN</html>');
});

test('serves a static JS file on the game port', async () => {
  const response = await fetch(`${origin}/assets/app.js?v=1`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  expect(await response.text()).toBe('export const ready = true;');
});

test('HEAD has content length but no body; missing assets are 404', async () => {
  const head = await fetch(origin, { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(head.headers.get('content-length')).toBe(String(Buffer.byteLength('<html>MICTLÁN</html>')));
  expect(await head.text()).toBe('');
  expect((await fetch(`${origin}/assets/missing.js`)).status).toBe(404);
  expect((await fetch(origin, { method: 'POST' })).status).toBe(405);
});

test('Colyseus health and CORS preflight remain available', async () => {
  expect(await (await fetch(`${origin}/__healthcheck`)).text()).toBe('OK');
  const response = await fetch(`${origin}/matchmake/create/raid`, { method: 'OPTIONS' });
  expect(response.status).toBe(204);
});

async function readyPlayer(room: Room<unknown, LobbyState>, classId: string): Promise<void> {
  connections.push(room);
  room.onMessage('events', () => undefined);
  room.send('ready', { classId });
  await vi.waitFor(() => expect(room.state.players.get(room.sessionId)?.ready).toBe(true));
}

test('C1: real WebSockets share HTTP port and production waits for three roles despite dev env', async () => {
  const client = new Client(origin.replace('http:', 'ws:'));
  const jaguar = await client.create<LobbyState>('raid');
  await readyPlayer(jaguar, 'jaguar');
  expect(jaguar.state.status).toBe('lobby');
  const healer = await client.joinById<LobbyState>(jaguar.roomId);
  await readyPlayer(healer, 'healer');
  expect(healer.state.status).toBe('lobby');
  const eagle = await client.joinById<LobbyState>(jaguar.roomId);
  await readyPlayer(eagle, 'eagle');
  await vi.waitFor(() => expect(connections.map((room) => room.state.status)).toEqual(['combat', 'combat', 'combat']));
  expect(eagle.state.entities.get('boss')?.maxHealth).toBe(24000);
  expect((await fetch(origin)).status).toBe(200);
});
