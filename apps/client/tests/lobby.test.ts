import { describe, expect, test } from 'vitest';
import { COMBAT_RULES, PARTY_RULES, type ClassId, type EncounterStatus } from '@mictlan/core';
import { connectionErrorText, LobbySelection, lobbyRejectionText, missingRoles, missingRolesText, resultText, screenForRoom } from '../src/lobby';
import { room } from './fixtures';
import { readRoomSnapshot } from '../src/snapshot';

function player(id: string, classId: ClassId | '', ready = true) {
  return { id, classId, ready };
}

describe('T3.5 missing lobby roles', () => {
  test('empty lobby needs Jaguar, Tícitl and at least one Águila', () => {
    expect(missingRoles([])).toEqual(['jaguar', 'healer', 'eagle']);
    expect(missingRolesText([])).toBe('Falta Jaguar · Falta Tícitl · Falta al menos un Águila');
  });

  test.each<ClassId>(['jaguar', 'healer', 'eagle'])('reports a missing %s even with other roles ready', (missing) => {
    const players = (['jaguar', 'healer', 'eagle'] as const)
      .filter((classId) => classId !== missing).map((classId) => player(classId, classId));
    expect(missingRoles(players)).toEqual([missing]);
  });

  test('a complete three-player composition has no missing roles', () => {
    expect(missingRolesText([player('a', 'jaguar'), player('b', 'healer'), player('c', 'eagle')]))
      .toBe('Composición completa');
  });

  test('supports the maximum party with three eagles', () => {
    const players = [player('a', 'jaguar'), player('b', 'healer'), player('c', 'eagle'), player('d', 'eagle'), player('e', 'eagle')];
    expect(players).toHaveLength(PARTY_RULES.maxPlayers);
    expect(missingRoles(players)).toEqual([]);
  });

  test('retained but unconfirmed classes and empty classes do not reserve a role', () => {
    expect(missingRoles([player('a', 'jaguar', false), player('b', 'healer', false), player('c', ''), player('d', 'eagle')]))
      .toEqual(['jaguar', 'healer']);
  });
});

describe('T3.5 screen routing', () => {
  test('waits for the first full Colyseus state after an empty reflected schema', () => {
    expect(readRoomSnapshot(undefined)).toBeUndefined();
    expect(readRoomSnapshot({})).toBeUndefined();
    expect(readRoomSnapshot({ status: 'lobby' })).toBeUndefined();
    const snapshot = room([], { status: 'lobby' });
    expect(readRoomSnapshot(snapshot)).toBe(snapshot);
    expect(screenForRoom(true, readRoomSnapshot({})?.status)).toBe('lobby');
  });

  test.each<EncounterStatus>(['lobby', 'combat', 'victory', 'defeat'])('without a room shows start regardless of stale %s', (status) => {
    expect(screenForRoom(false, status)).toBe('start');
  });

  test('waits in the lobby for the first snapshot', () => {
    expect(screenForRoom(true)).toBe('lobby');
  });

  test.each<EncounterStatus>(['victory', 'defeat'])('three players follow lobby → combat → %s → lobby', (result) => {
    const statuses: EncounterStatus[] = ['lobby', 'combat', result, 'lobby'];
    for (const id of ['a', 'b', 'c']) {
      const selection = new LobbySelection();
      const screens = statuses.map((status) => {
        const snapshot = room([], { status, players: {
          a: player('a', 'jaguar', status !== 'lobby'),
          b: player('b', 'healer', status !== 'lobby'),
          c: player('c', 'eagle', status !== 'lobby'),
        } });
        selection.receive(snapshot, id);
        return screenForRoom(true, snapshot.status);
      });
      expect(screens).toEqual(['lobby', 'arena', 'result', 'lobby']);
      expect(selection.classId).toBe({ a: 'jaguar', b: 'healer', c: 'eagle' }[id]);
      expect(selection.ready).toBe(false);
    }
  });

  test('dev bypasses lobby before and after combat and still shows the result', () => {
    expect(screenForRoom(true, undefined, true)).toBe('arena');
    expect(screenForRoom(true, 'lobby', true)).toBe('arena');
    expect(screenForRoom(true, 'combat', true)).toBe('arena');
    expect(screenForRoom(true, 'defeat', true)).toBe('result');
    expect(screenForRoom(true, 'lobby', true)).toBe('arena');
  });
});

describe('T3.5 readiness and rejections', () => {
  test('a second Jaguar sees the server rejection, stays unready and can choose another class', () => {
    const selection = new LobbySelection();
    const snapshot = room([], { status: 'lobby', players: { a: player('a', 'jaguar'), b: player('b', '', false) } });
    selection.receive(snapshot, 'b');
    selection.choose('jaguar');
    selection.reject({ reason: 'composition' });
    expect(selection.error).toBe('Ese rol ya está ocupado');
    expect(selection.ready).toBe(false);
    selection.receive(snapshot, 'b');
    expect(selection.error).toBe('Ese rol ya está ocupado');
    selection.choose('healer');
    expect(selection.classId).toBe('healer');
    expect(selection.error).toBe('');
    expect(selection.ready).toBe(false);
    selection.receive(room([], { status: 'lobby', players: { b: player('b', 'healer') } }), 'b');
    expect(selection.ready).toBe(true);
  });

  test('only a server confirmation marks ready; a draft survives other player patches', () => {
    const selection = new LobbySelection();
    const snapshot = room([], { status: 'lobby', players: { a: player('a', 'eagle', false) } });
    selection.receive(snapshot, 'a');
    selection.choose('healer');
    selection.receive(snapshot, 'a');
    expect(selection.classId).toBe('healer');
    expect(selection.ready).toBe(false);
    selection.receive(room([], { status: 'lobby', players: { a: player('a', 'healer') } }), 'a');
    selection.choose('jaguar');
    expect(selection.classId).toBe('healer');
    expect(selection.ready).toBe(true);
  });

  test('invalid class is translated exactly', () => {
    expect(lobbyRejectionText({ reason: 'invalid_class' })).toBe('Clase inválida');
  });

  test.each([null, undefined, {}, 'composition', { reason: 'unknown' }])('handles an unexpected payload %j', (payload) => {
    expect(lobbyRejectionText(payload)).toBe('No se pudo confirmar tu clase');
  });

  test('a failed join explains an absent code; failed creation explains connection failure', () => {
    expect(connectionErrorText(true)).toContain('el código no existe');
    expect(connectionErrorText(false)).toContain('No se pudo conectar al servidor');
  });
});

describe('T3.5 results', () => {
  test.each([['victory', '¡Victoria!'], ['defeat', 'Derrota']] as const)('%s shows encounter duration in minutes and seconds', (status, title) => {
    expect(resultText({ status, elapsedTicks: 125 * COMBAT_RULES.ticksPerSecond })).toEqual({
      title, duration: 'Duración del encuentro: 02:05',
    });
  });
});
