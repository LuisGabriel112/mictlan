import { expect, test } from 'vitest';
import { buildReport } from '../sim/report.js';
import { runEncounter } from '../sim/runner.js';

test('T4.2: all 50 three-player runs win with a mean duration of 90–150 seconds (temporary playtest tuning, SPEC §6 v0.10)', () => {
  const encounters = Array.from({ length: 50 }, (_, index) =>
    runEncounter({ players: 3, seed: index + 1 }));
  const report = buildReport(3, encounters);
  expect(report.runs).toBe(50);
  expect(report.victoryRate).toBe(1);
  expect(report.averageDurationSeconds).toBeGreaterThanOrEqual(90);
  expect(report.averageDurationSeconds).toBeLessThanOrEqual(150);
}, 30000);
