import { expect, test } from 'vitest';
import { LobbyPlayerState, LobbyState } from '../src/schema/LobbyState.js';
import { resetLobby, syncEncounter } from '../src/schema/sync.js';
import { activeFixture } from './schema-fixture.js';

test('resetLobby clears combat and readiness while preserving roster, code and selected classes', () => {
  const lobby = new LobbyState({ code: 'ABCD' });
  lobby.players.set('healer', new LobbyPlayerState({ id: 'healer', classId: 'healer', ready: true }));
  lobby.players.set('eagle', new LobbyPlayerState({ id: 'eagle', classId: 'eagle', ready: true }));
  syncEncounter(lobby, { ...activeFixture(), status: 'victory', tick: 90, elapsedTicks: 70 });
  resetLobby(lobby);
  expect(lobby.toJSON()).toEqual({ code: 'ABCD', status: 'lobby', entities: {}, zones: {},
    phase: 0, safeRadiusMeters: 0, tick: 0, elapsedTicks: 0, players: {
      healer: { id: 'healer', classId: 'healer', ready: false }, eagle: { id: 'eagle', classId: 'eagle', ready: false },
    } });
  resetLobby(lobby);
  expect(lobby.entities.size).toBe(0);
});
