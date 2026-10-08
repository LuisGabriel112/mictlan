import { expect, test } from 'vitest';
import type { EncounterStatus } from '@mictlan/core';
import { connectionErrorText, lobbyPlayerText, lobbyRejectionText, missingRoles, screenForRoom } from '../src/lobby';

test('missingRoles requires ready players and ignores empty or retained classes', () => {
  expect(missingRoles([])).toEqual(['Falta Jaguar', 'Falta Tícitl', 'Falta al menos un Águila']);
  expect(missingRoles([{ id: 'j', classId: 'jaguar', ready: false }, { id: 'x', classId: '', ready: true }]))
    .toEqual(missingRoles([]));
  expect(missingRoles([{ id: 'j', classId: 'jaguar', ready: true }]))
    .toEqual(['Falta Tícitl', 'Falta al menos un Águila']);
});

test('one or three ready eagles complete the required composition', () => {
  const specialists = [{ id: 'j', classId: 'jaguar', ready: true }, { id: 'h', classId: 'healer', ready: true }] as const;
  expect(missingRoles(specialists)).toEqual(['Falta al menos un Águila']);
  const eagles = ['a', 'b', 'c'].map((id) => ({ id, classId: 'eagle' as const, ready: true }));
  expect(missingRoles([...specialists, eagles[0]])).toEqual([]);
  expect(missingRoles([...specialists, ...eagles])).toEqual([]);
});

test.each([
  [{ reason: 'composition' }, 'Ese rol ya está ocupado'],
  [{ reason: 'invalid_class' }, 'Clase inválida'],
  [{ reason: 'unknown' }, 'No se pudo marcar listo. Inténtalo de nuevo.'],
  [null, 'No se pudo marcar listo. Inténtalo de nuevo.'],
  ['composition', 'No se pudo marcar listo. Inténtalo de nuevo.'],
  [{}, 'No se pudo marcar listo. Inténtalo de nuevo.'],
  [{ reason: 1 }, 'No se pudo marcar listo. Inténtalo de nuevo.'],
])('lobbyRejectionText translates and validates %j', (payload, expected) => {
  expect(lobbyRejectionText(payload)).toBe(expected);
});

test.each([
  [{ code: 522 }, 'La sala no existe. Revisa el código.'],
  [{ code: 522, message: 'room "ABCD" not found' }, 'La sala no existe. Revisa el código.'],
  [{ code: 522, message: 'room "ABCD" is locked' }, 'La sala está llena o ya inició el combate.'],
  [{ code: 522, message: null }, 'La sala no existe. Revisa el código.'],
  [{ code: 522, message: 123 }, 'La sala no existe. Revisa el código.'],
  [{ code: 521 }, 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
  [{ code: 521, message: 'room "ABCD" is locked' }, 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
  [new Error('offline'), 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
  [null, 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
  ['offline', 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
  [{ code: '522' }, 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
])('connectionErrorText translates %j without exposing transport details', (error, expected) => {
  expect(connectionErrorText(error)).toBe(expected);
});

test.each<EncounterStatus>(['lobby', 'combat', 'victory', 'defeat'])('no room always shows start (%s)', (status) => {
  expect(screenForRoom(status, false, false)).toBe('start');
  expect(screenForRoom(status, false, true)).toBe('start');
});

test.each([
  [undefined, false, 'lobby'], ['lobby', false, 'lobby'], ['combat', false, 'combat'],
  ['victory', false, 'result'], ['defeat', false, 'result'], ['lobby', true, 'combat'],
  [undefined, true, 'combat'], ['combat', true, 'combat'], ['victory', true, 'result'], ['defeat', true, 'result'],
] as const)('screenForRoom %s dev=%s', (status, dev, expected) => {
  expect(screenForRoom(status, true, dev)).toBe(expected);
});

test('lobbyPlayerText identifies self, class and authoritative readiness', () => {
  expect(lobbyPlayerText({ id: 'j', classId: 'jaguar', ready: true }, 'j')).toBe('Tú · Guerrero Jaguar · Listo');
  expect(lobbyPlayerText({ id: 'h', classId: 'healer', ready: false }, 'j')).toBe('h · Tícitl · Sin preparar');
  expect(lobbyPlayerText({ id: 'e', classId: 'eagle', ready: true }, 'j')).toBe('e · Guerrero Águila · Listo');
  expect(lobbyPlayerText({ id: 'x', classId: '', ready: false }, 'j')).toBe('x · Sin clase · Sin preparar');
});
