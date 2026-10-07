import { expect, test } from 'vitest';
import { COMBAT_LOOP_RULES, consumeTicks } from '../src/combat-clock.js';

function totalSteps(slices: readonly number[]): { steps: number; accumulatedMs: number } {
  let accumulatedMs = 0;
  let steps = 0;
  for (const deltaMs of slices) {
    const result = consumeTicks(accumulatedMs, deltaMs);
    steps += result.steps;
    accumulatedMs = result.accumulatedMs;
  }
  return { steps, accumulatedMs };
}

test('rules match the 20 Hz core tick and a five-step catch-up cap', () => {
  expect(COMBAT_LOOP_RULES).toEqual({ tickMs: 50, maxStepsPerAdvance: 5 });
});

test('1000 ms in uneven slices produce exactly 20 steps', () => {
  expect(totalSteps([30, 30, 45, 70, 25, 50, 150, 100, 200, 200, 100])).toEqual({ steps: 20, accumulatedMs: 0 });
});

test('the remainder below one tick is kept for the next call', () => {
  expect(consumeTicks(0, 49)).toEqual({ steps: 0, accumulatedMs: 49 });
  expect(consumeTicks(49, 1)).toEqual({ steps: 1, accumulatedMs: 0 });
  expect(consumeTicks(10, 120)).toEqual({ steps: 2, accumulatedMs: 30 });
});

test('a stall runs at most five steps and discards the backlog', () => {
  expect(consumeTicks(0, 2000)).toEqual({ steps: 5, accumulatedMs: 0 });
  expect(consumeTicks(0, 250)).toEqual({ steps: 5, accumulatedMs: 0 });
  expect(consumeTicks(0, 299)).toEqual({ steps: 5, accumulatedMs: 0 });
});

test.each([-50, Number.NaN, Number.POSITIVE_INFINITY])('an invalid delta %s adds no time', (deltaMs) => {
  expect(consumeTicks(20, deltaMs)).toEqual({ steps: 0, accumulatedMs: 20 });
});
