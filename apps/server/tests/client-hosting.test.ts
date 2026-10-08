import { EventEmitter } from 'node:events';
import type { Server } from 'node:http';
import { expect, test, vi } from 'vitest';
import { attachClientHosting, isColyseusRequest } from '../src/client-hosting.js';

test.each([
  ['/matchmake/create/raid', true], ['/matchmake/joinById/ABCD?x=1', true],
  ['/__healthcheck?x=1', true], ['/matchmake', true], ['/matchmake-fake', false],
  ['/__healthcheck-fake', false], ['/', false], [undefined, false],
])('isColyseusRequest recognizes %s', (url, expected) => { expect(isColyseusRequest(url)).toBe(expected); });

test('attachClientHosting preserves Colyseus listeners and serves other requests once', async () => {
  const server = new EventEmitter();
  const colyseus = vi.fn();
  const serve = vi.fn().mockResolvedValue(undefined);
  server.on('request', colyseus);
  attachClientHosting(server as Server, 'dist', serve);
  const response = {};
  server.emit('request', { url: '/matchmake/create/raid' }, response);
  expect(colyseus).toHaveBeenCalledExactlyOnceWith({ url: '/matchmake/create/raid' }, response);
  expect(serve).not.toHaveBeenCalled();
  server.emit('request', { url: '/' }, response);
  expect(serve).toHaveBeenCalledExactlyOnceWith({ url: '/' }, response, 'dist');
  expect(colyseus).toHaveBeenCalledTimes(1);
  expect(server.listenerCount('request')).toBe(1);
});
