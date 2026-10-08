import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { serveClient } from './static-client.js';

export function isColyseusRequest(url = '/'): boolean {
  const pathname = url.split('?')[0];
  return pathname === '/__healthcheck' || /^\/matchmake(?:\/|$)/.test(pathname);
}

export function attachClientHosting(server: Server, directory: string, serve = serveClient): void {
  // Colyseus registers HTTP listeners at listen-time; capture them after listen resolves.
  const colyseusListeners = server.listeners('request');
  server.removeAllListeners('request');
  server.on('request', (request: IncomingMessage, response: ServerResponse) => {
    if (isColyseusRequest(request.url)) {
      for (const listener of colyseusListeners) listener.call(server, request, response);
      return;
    }
    void serve(request, response, directory);
  });
}
