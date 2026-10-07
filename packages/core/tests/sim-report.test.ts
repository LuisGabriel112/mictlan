import { expect, test } from 'vitest';
import { BOSS, createEncounter } from '../src/index.js';
import type { CombatEvent, EncounterState } from '../src/index.js';
import { abilityName, buildReport, formatReport } from '../sim/report.js';
import { parseArgs } from '../sim/run.js';
import type { RunEncounterResult } from '../sim/runner.js';
import { createBotParty } from '../sim/bots.js';

// player:1 = Jaguar, player:2 = Tícitl, player:3 = Águila.
function syntheticRun(
  status: EncounterState['status'],
  elapsedTicks: number,
  events: CombatEvent[],
  bossTargetChanges = 0,
): RunEncounterResult {
  const state = { ...createEncounter({ players: createBotParty(3), critChance: 0 }, 1), status, elapsedTicks };
  return { state, events, ticks: elapsedTicks, bossTargetChanges };
}

function damage(sourceId: string, targetId: string, amount: number): CombatEvent {
  return { type: 'damage', tick: 1, sourceId, abilityId: 'obsidianArrow', targetId, amount, critical: false };
}

function healing(sourceId: string, amount: number, effectiveAmount: number): CombatEvent {
  return { type: 'healing', tick: 1, sourceId, abilityId: 'remedy', targetId: 'player:1',
    amount, effectiveAmount, critical: false };
}

const runs = [
  syntheticRun('victory', 2000, [
    damage('player:3', BOSS.id, 6000),
    damage('player:1', BOSS.id, 2000),
    healing('player:2', 300, 200),
    damage(BOSS.id, 'player:1', 999),
  ], 2),
  syntheticRun('defeat', 6000, [
    damage('player:3', BOSS.id, 6000),
    healing('player:2', 500, 500),
    { type: 'death', tick: 5, entityId: 'player:3', sourceId: BOSS.id, abilityId: 'lamentOfTheDead' },
    { type: 'death', tick: 6, entityId: 'player:2', sourceId: BOSS.id, abilityId: 'lamentOfTheDead' },
    { type: 'death', tick: 7, entityId: 'player:1', sourceId: 'environment', abilityId: 'unsafeGround' },
    { type: 'death', tick: 8, entityId: 'xolo:0', sourceId: 'player:3', abilityId: 'obsidianArrow' },
  ], 4),
];

test('victory rate and average duration from the pull', () => {
  const report = buildReport(3, runs);
  expect(report.runs).toBe(2);
  expect(report.victoryRate).toBe(0.5);
  // 2000 and 6000 ticks = 100 s and 300 s.
  expect(report.averageDurationSeconds).toBe(200);
});

test('player deaths grouped by the lethal ability, excluding enemy deaths', () => {
  expect(buildReport(3, runs).deathsByAbility).toEqual([
    { abilityId: 'lamentOfTheDead', deaths: 2 },
    { abilityId: 'unsafeGround', deaths: 1 },
  ]);
});

test('DPS and HPS per player of each class over total combat time; enemy damage ignored', () => {
  // Total time per single-player class: 100 s + 300 s = 400 s.
  expect(buildReport(3, runs).classRates).toEqual([
    { classId: 'jaguar', players: 1, dps: 2000 / 400, hps: 0 },
    { classId: 'healer', players: 1, dps: 0, hps: (200 + 500) / 400 },
    { classId: 'eagle', players: 1, dps: 12000 / 400, hps: 0 },
  ]);
});

test('average boss target changes per run', () => {
  expect(buildReport(3, runs).averageBossTargetChanges).toBe(3);
});

test('an empty result set yields zeros instead of NaN', () => {
  expect(buildReport(3, [])).toMatchObject({ runs: 0, victoryRate: 0, averageDurationSeconds: 0,
    averageBossTargetChanges: 0, deathsByAbility: [], classRates: [] });
});

test('the formatted report shows every metric in Spanish', () => {
  const text = formatReport(buildReport(3, runs));
  for (const expected of ['Victorias:', '50.0 %', 'Duración media:', '3:20', 'Cambios de objetivo del jefe',
    'Lamento de los muertos', 'Fuera del radio seguro', 'Guerrero Jaguar ×1', 'Tícitl ×1', 'Guerrero Águila ×1',
    'DPS', 'HPS']) {
    expect(text).toContain(expected);
  }
});

test('ability names come from the data in Spanish', () => {
  expect(abilityName('flayedStrike')).toBe('Golpe del Descarnado');
  expect(abilityName('remedy')).toBe('Remedio');
  expect(abilityName('autoAttack')).toBe('Auto-ataque');
});

test('parseArgs accepts valid players and runs', () => {
  expect(parseArgs(['--players=3', '--runs=50'])).toEqual({ players: 3, runs: 50 });
  expect(parseArgs(['--runs=1', '--players=5'])).toEqual({ players: 5, runs: 1 });
});

test.each([
  [['--runs=5'], 'Falta el argumento --players'],
  [['--players=3'], 'Falta el argumento --runs'],
  [['--players=2', '--runs=5'], 'entre 3 y 5'],
  [['--players=6', '--runs=5'], 'entre 3 y 5'],
  [['--players=3', '--runs=0'], 'al menos 1'],
  [['--players=tres', '--runs=5'], 'debe ser un entero'],
  [['--players=3', '--runs=2.5'], 'debe ser un entero'],
])('parseArgs rejects %j', (args, message) => {
  expect(() => parseArgs(args)).toThrow(message);
});
