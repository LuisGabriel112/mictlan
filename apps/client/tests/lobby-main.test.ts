import { afterEach, expect, test, vi } from 'vitest';
import { Client } from '@colyseus/sdk';
import { ArenaScene } from '../src/scene/ArenaScene';
import { HelpView } from '../src/help-view';
import { createBrowserWorld } from '../src/world-3d/browser-world';
import { domListener, lobbyDocument } from './lobby-dom-fixtures';
import { lobbyConnection } from './lobby-fixtures';

vi.mock('@colyseus/sdk', () => ({ Client: vi.fn() }));
vi.mock('../src/scene/ArenaScene', () => ({ ArenaScene: vi.fn(function () { return { create: vi.fn() }; }) }));
vi.mock('../src/world-3d/browser-world', () => ({ createBrowserWorld: vi.fn(() => ({ world: true })) }));
vi.mock('../src/help-view', () => ({ HelpView: vi.fn(function () { return { render: vi.fn() }; }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

test('main composes the lobby and creates a native arena only after joining', async () => {
  const { document, element } = lobbyDocument();
  const { connection } = lobbyConnection(); const create = vi.fn(async () => connection);
  vi.mocked(Client).mockImplementation(function () { return { create } as unknown as Client; });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { location: { search: '?code=ABCD', hostname: 'localhost' }, innerWidth: 1280, innerHeight: 720,
    devicePixelRatio: 2, addEventListener: vi.fn(), performance: { now: () => 42 } });
  await import('../src/main');
  expect(Client).toHaveBeenCalledWith('ws://localhost:2567'); expect(ArenaScene).not.toHaveBeenCalled();
  expect(element('room-code').value).toBe('ABCD'); expect(HelpView).toHaveBeenCalledWith(document, window);
  await domListener(element('create-room'), 'click')({} as Event);
  expect(create).toHaveBeenCalledExactlyOnceWith('raid');
  const [receivedRoom, factory, environment] = vi.mocked(ArenaScene).mock.calls[0];
  expect(receivedRoom).toBe(connection); factory();
  expect(createBrowserWorld).toHaveBeenCalledWith(element('game'), 2);
  expect(environment.now()).toBe(42);
  expect(vi.mocked(ArenaScene).mock.results[0].value.create).toHaveBeenCalledOnce();
});
