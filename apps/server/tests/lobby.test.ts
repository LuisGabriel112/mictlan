import { expect, test } from 'vitest';
import { canStartEncounter, encounterConfig, isClassId, parseMinimumPlayers, parseReadyClass, validateReady } from '../src/lobby.js';
import type { LobbyPlayer } from '../src/lobby.js';

const completeParty: LobbyPlayer[] = [
  { id: 'tank', classId: 'jaguar', ready: true },
  { id: 'healer', classId: 'healer', ready: true },
  { id: 'dps', classId: 'eagle', ready: true },
];

test.each([undefined, '', '0', '4', '-1', '1.5', 'NaN', 'Infinity', '1abc', '1e0', '0x1'])(
  'parseMinimumPlayers defaults invalid %s to three', (value) => {
    expect(parseMinimumPlayers(value)).toBe(3);
  },
);

test.each(['1', '2', '3'])('parseMinimumPlayers accepts %s', (value) => {
  expect(parseMinimumPlayers(value)).toBe(Number(value));
});

test.each([null, undefined, 1, true, 'jaguar', [], {}, { classId: [] }, { classId: 'Jaguar' }, { classId: 'toString' }])(
  'parseReadyClass rejects malformed payload %j', (payload) => {
    expect(parseReadyClass(payload)).toBeUndefined();
    expect(validateReady([], 'new', payload)).toEqual({ reason: 'invalid_class' });
  },
);

test.each(['jaguar', 'healer', 'eagle'] as const)('parseReadyClass accepts %s', (classId) => {
  expect(parseReadyClass({ classId })).toBe(classId);
});

test('isClassId accepts only the three own class keys', () => {
  expect(['jaguar', 'healer', 'eagle'].every(isClassId)).toBe(true);
  expect([null, 1, {}, 'toString', '', 'Jaguar'].some(isClassId)).toBe(false);
});

test.each(['jaguar', 'healer'] as const)('validateReady forbids a second %s even in dev', (classId) => {
  expect(validateReady(completeParty, 'new', { classId })).toEqual({ reason: 'composition' });
});

test('validateReady permits three eagles but rejects a fourth', () => {
  const eagles = ['a', 'b', 'c'].map((id): LobbyPlayer => ({ id, classId: 'eagle', ready: true }));
  expect(validateReady(eagles.slice(0, 2), 'new', { classId: 'eagle' })).toEqual({ classId: 'eagle' });
  expect(validateReady(eagles, 'new', { classId: 'eagle' })).toEqual({ reason: 'composition' });
});

test('validateReady counts only other ready players and permits idempotent ready', () => {
  expect(validateReady(completeParty, 'tank', { classId: 'jaguar' })).toEqual({ classId: 'jaguar' });
  const unready: LobbyPlayer[] = [{ id: 'other', classId: 'jaguar', ready: false }];
  expect(validateReady(unready, 'new', { classId: 'jaguar' })).toEqual({ classId: 'jaguar' });
  expect(unready[0].ready).toBe(false);
});

test('canStartEncounter requires all ready, complete composition and size three to five', () => {
  expect(canStartEncounter(completeParty, 3)).toBe(true);
  expect(canStartEncounter(completeParty.slice(0, 2), 3)).toBe(false);
  expect(canStartEncounter([...completeParty, { id: 'other', classId: '', ready: false }], 3)).toBe(false);
  const extra: LobbyPlayer = { id: 'extra', classId: 'eagle', ready: true };
  expect(canStartEncounter([...completeParty, extra, extra], 3)).toBe(true);
  expect(canStartEncounter([...completeParty, extra, extra, extra], 3)).toBe(false);
  expect(canStartEncounter([extra, extra, extra], 3)).toBe(false);
});

test('canStartEncounter relaxes missing roles only in dev and keeps class limits', () => {
  expect(canStartEncounter([completeParty[0]], 1)).toBe(true);
  expect(canStartEncounter([completeParty[0]], 2)).toBe(false);
  expect(canStartEncounter(completeParty.slice(0, 2), 2)).toBe(true);
  expect(canStartEncounter([completeParty[0], completeParty[0]], 1)).toBe(false);
  expect(canStartEncounter([{ id: 'bad', classId: '', ready: true }], 1)).toBe(false);
  expect(canStartEncounter([], 1)).toBe(false);
});

test('encounterConfig preserves ids and supplies devMode only below three', () => {
  expect(encounterConfig(completeParty, 3)).toEqual({
    players: completeParty.map(({ id, classId }) => ({ id, classId })), devMode: false,
  });
  expect(encounterConfig([completeParty[2]], 1)).toEqual({
    players: [{ id: 'dps', classId: 'eagle' }], devMode: true,
  });
  expect(encounterConfig([{ id: 'unready', classId: '', ready: false }], 3).players).toEqual([]);
});
