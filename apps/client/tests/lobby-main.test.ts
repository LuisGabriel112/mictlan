import { afterEach, expect, test, vi } from 'vitest';
import { Client } from '@colyseus/sdk';
import * as Phaser from 'phaser';
import { ArenaScene } from '../src/scene/ArenaScene';
import { HelpView } from '../src/help-view';
import { domListener, lobbyDocument } from './lobby-dom-fixtures';
import { lobbyConnection } from './lobby-fixtures';

vi.mock('@colyseus/sdk', () => ({ Client: vi.fn() }));
vi.mock('phaser', () => ({ Game: vi.fn(), AUTO: 0, Scale: { RESIZE: 5 } }));
vi.mock('../src/scene/ArenaScene', () => ({ ArenaScene: vi.fn() }));
vi.mock('../src/help-view', () => ({ HelpView: vi.fn(function () { return { render: vi.fn() }; }) }));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); vi.resetModules(); });

test('main composes the start screen and boots one arena only after the player creates a room', async () => {
  const { document, element } = lobbyDocument();
  const { connection } = lobbyConnection();
  const create = vi.fn(async () => connection);
  vi.mocked(Client).mockImplementation(function () { return { create } as unknown as Client; });
  vi.stubGlobal('document', document);
  vi.stubGlobal('window', { location: { search: '?code=ABCD', hostname: 'localhost' }, innerWidth: 1280, innerHeight: 720 });
  await import('../src/main');
  expect(Client).toHaveBeenCalledWith('ws://localhost:2567');
  expect(Phaser.Game).not.toHaveBeenCalled();
  expect(element('room-code').value).toBe('ABCD');
  expect(HelpView).toHaveBeenCalledWith(document, window);
  expect(vi.mocked(HelpView).mock.results[0].value.render).toHaveBeenCalledWith('start', 'eagle');
  await domListener(element('create-room'), 'click')({} as Event);
  expect(create).toHaveBeenCalledExactlyOnceWith('raid');
  expect(ArenaScene).toHaveBeenCalledWith(connection);
  expect(Phaser.Game).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ parent: 'game',
    scale: { mode: 5, width: 1280, height: 720 }, backgroundColor: '#14101c' }));
});
