import { expect, test, vi } from 'vitest';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createServer } from 'node:http';
import { createRaidServer, startRaidServer } from '../src/server.js';

vi.mock('node:http', () => ({ createServer: vi.fn(() => ({ close: vi.fn() })) }));
vi.mock('@colyseus/ws-transport', () => ({ WebSocketTransport: vi.fn(class {}) }));
vi.mock('@colyseus/core', async (original) => ({
  ...await original<typeof import('@colyseus/core')>(),
  Server: vi.fn(class {
    define = vi.fn();
    listen = vi.fn().mockResolvedValue(undefined);
  }),
}));

test('createRaidServer connects HTTP, WebSocket transport and the raid definition', () => {
  const hosted = createRaidServer({ MICTLAN_DEV_MIN_PLAYERS: '2' }, () => 0.5);
  expect(createServer).toHaveBeenCalled();
  expect(WebSocketTransport).toHaveBeenLastCalledWith({ server: hosted.httpServer });
  expect(Server).toHaveBeenLastCalledWith({ transport: expect.any(WebSocketTransport), greet: false, gracefullyShutdown: false });
  expect(hosted.gameServer.define).toHaveBeenCalledWith('raid', expect.any(Function));
});

test.each([[{}, 2567], [{ PORT: '3456' }, 3456]])('startRaidServer listens on configured/default port', async (environment, port) => {
  const hosted = await startRaidServer(environment);
  expect(hosted.gameServer.listen).toHaveBeenCalledExactlyOnceWith(port);
});

test('server factories read process environment by default', async () => {
  vi.stubEnv('PORT', '4567');
  const hosted = await startRaidServer();
  expect(hosted.gameServer.listen).toHaveBeenCalledWith(4567);
  expect(createRaidServer().gameServer.define).toHaveBeenCalledWith('raid', expect.any(Function));
  vi.unstubAllEnvs();
});
