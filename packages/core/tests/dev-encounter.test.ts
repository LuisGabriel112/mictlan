import { expect, test } from 'vitest';
import { BOSS, createEncounter } from '../src/index.js';
import { scaledPlayerCount, validatePartySize } from '../src/party.js';
import { summonXolos } from '../src/mechanics/xolos.js';
import type { EncounterConfig } from '../src/types.js';

function devConfig(count: number, devMode = true): EncounterConfig {
  const players = Array.from({ length: count }, (_, index) => ({
    id: `p${index}`, classId: 'eagle' as const,
  }));
  return { players, devMode };
}

test('C4: two players require explicit devMode', () => {
  const { players } = devConfig(2);
  expect(() => createEncounter({ players }, 42)).toThrow('entre 3 y 5');
  expect(() => createEncounter({ players, devMode: false }, 42)).toThrow('entre 3 y 5');
});

test.each([
  [1, BOSS.maxHealthByPlayerCount[3], 300],
  [2, BOSS.maxHealthByPlayerCount[3], 300],
  [3, BOSS.maxHealthByPlayerCount[3], 300],
  [4, BOSS.maxHealthByPlayerCount[4], 450],
  [5, BOSS.maxHealthByPlayerCount[5], 600],
])(
  'C4: dev party %i scales boss to %i and xolos to %i', (count, bossHealth, xoloHealth) => {
    const initial = createEncounter(devConfig(count), 42);
    const summoned = summonXolos(initial);
    expect(initial.entities.boss).toMatchObject({ health: bossHealth, maxHealth: bossHealth });
    const xolos = Object.values(summoned.entities).filter((entity) => entity.type === 'xolo');
    expect(xolos).toHaveLength(2);
    expect(xolos.map(({ health, maxHealth }) => [health, maxHealth])).toEqual([
      [xoloHealth, xoloHealth], [xoloHealth, xoloHealth],
    ]);
    expect(initial.entities.p0).toMatchObject({ x: 1 - count, y: -15 });
    expect(initial.config.players).toHaveLength(count);
    expect(initial.config.devMode).toBe(true);
    expect(initial).toEqual(createEncounter(devConfig(count), 42));
  },
);

test.each([0, 6])('dev encounter rejects %i players', (count) => {
  expect(() => createEncounter(devConfig(count), 42)).toThrow('entre 1 y 5');
});

test.each([1, 2, 3, 4, 5])('scaledPlayerCount clamps %i at the normal minimum', (count) => {
  expect(scaledPlayerCount(count)).toBe(Math.max(count, 3));
});

test('validatePartySize checks both normal and development boundaries', () => {
  expect(() => validatePartySize(devConfig(1))).not.toThrow();
  expect(() => validatePartySize(devConfig(5))).not.toThrow();
  expect(() => validatePartySize(devConfig(3, false))).not.toThrow();
  expect(() => validatePartySize(devConfig(2, false))).toThrow('entre 3 y 5');
  expect(() => validatePartySize(devConfig(6))).toThrow('entre 1 y 5');
});
