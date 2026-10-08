import { expect, test } from 'vitest';
import { isSyncedSnapshot } from '../src/snapshot';
import { room } from './fixtures';

test('isSyncedSnapshot accepts a full room state', () => {
  expect(isSyncedSnapshot(room([]))).toBe(true);
});

test.each([
  ['undefined', undefined],
  ['null', null],
  ['an empty object', {}],
  ['a state without status', { ...room([]), status: undefined }],
  ['a state without players', { ...room([]), players: undefined }],
  ['a state without entities', { ...room([]), entities: undefined }],
  ['a state without zones', { ...room([]), zones: undefined }],
  ['a state with null players', { ...room([]), players: null }],
])('isSyncedSnapshot rejects %s', (_label, value) => {
  expect(isSyncedSnapshot(value)).toBe(false);
});
