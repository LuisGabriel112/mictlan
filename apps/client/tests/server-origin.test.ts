import { afterEach, expect, test, vi } from 'vitest';
import { parseClassId, parseLaunchParams, serverUrlForPage } from '../src/launch-params';
import { Client } from '@colyseus/sdk';
import { lobbyDocument } from './lobby-dom-fixtures';

const tunnel = { protocol: 'https:', host: 'raid.trycloudflare.com', hostname: 'raid.trycloudflare.com' };

test.each([[null, 'eagle'], ['', 'eagle'], ['wizard', 'eagle'], ['jaguar', 'jaguar'], ['healer', 'healer']])(
  'parseClassId validates %s', (requested, expected) => { expect(parseClassId(requested)).toBe(expected); });

vi.mock('@colyseus/sdk', () => ({ Client: vi.fn() }));
vi.mock('phaser', () => ({}));
vi.mock('../src/scene/ArenaScene', () => ({}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); });

test.each([
  [tunnel, true, 'wss://raid.trycloudflare.com'],
  [{ protocol: 'http:', host: 'localhost:2567', hostname: 'localhost' }, true, 'ws://localhost:2567'],
  [{ ...tunnel, host: 'raid.example:8443' }, true, 'wss://raid.example:8443'],
  [{ ...tunnel, protocol: 'http:', host: 'raid.example' }, true, 'ws://raid.example'],
  [{ protocol: 'http:', host: '192.168.1.5:5173', hostname: '192.168.1.5' }, false, 'ws://192.168.1.5:2567'],
  [tunnel, false, 'ws://raid.trycloudflare.com:2567'],
])('serverUrlForPage(%j, %s)', (page, production, expected) => {
  expect(serverUrlForPage(page, production)).toBe(expected);
  expect(parseLaunchParams('', page, production).serverUrl).toBe(expected);
});

test.each([true, false])('explicit server overrides build mode %s; empty server uses default', (production) => {
  expect(parseLaunchParams('?server=wss%3A%2F%2Fother.example%3A443', tunnel, production).serverUrl).toBe('wss://other.example:443');
  expect(parseLaunchParams('?server=', tunnel, production).serverUrl).toBe(serverUrlForPage(tunnel, production));
});

test('production main passes the page origin and Vite build mode to the SDK', async () => {
  vi.stubEnv('PROD', true);
  vi.stubGlobal('document', lobbyDocument().document);
  vi.stubGlobal('window', { location: { ...tunnel, search: '' } });
  await import('../src/main');
  expect(Client).toHaveBeenLastCalledWith('wss://raid.trycloudflare.com');
});
