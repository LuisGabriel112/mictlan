import { describe, expect, test } from 'vitest';
import { createEncounter, createRngState, nextRandom, step } from '../src/index.js';

function sequence(seed: number): number[] {
  let rngState = createRngState(seed);
  return Array.from({ length: 200 }, () => {
    const next = nextRandom(rngState);
    rngState = next.rngState;
    return next.value;
  });
}

describe('T1.2 seeded RNG', () => {
  test('the same seed produces the same sequence and another seed a different one', () => {
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(43)).not.toEqual(sequence(42));
  });

  test.each([0, 1, -1, 0xffffffff])('seed %i yields fractions and unsigned integer state', (seed) => {
    let rngState = createRngState(seed);
    expect(rngState).toBe(seed >>> 0);
    for (let index = 0; index < 200; index += 1) {
      const next = nextRandom(rngState);
      expect(next.value).toBeGreaterThanOrEqual(0);
      expect(next.value).toBeLessThan(1);
      expect(Number.isInteger(next.rngState)).toBe(true);
      expect(next.rngState).toBeGreaterThanOrEqual(0);
      expect(next.rngState).toBeLessThanOrEqual(0xffffffff);
      rngState = next.rngState;
    }
  });

  test('the encounter holds all RNG state and a saved state reproduces the next draw', () => {
    const state = createEncounter({
      players: [
        { id: 'p1', classId: 'jaguar' },
        { id: 'p2', classId: 'healer' },
        { id: 'p3', classId: 'eagle' },
      ],
      critChance: 0,
    }, 42);
    const first = nextRandom(state.rngState);
    const advanced = { ...state, rngState: first.rngState };
    const saved = structuredClone(advanced);
    sequence(100);
    expect(nextRandom(saved.rngState)).toEqual(nextRandom(advanced.rngState));
    expect(nextRandom(state.rngState)).toEqual(first);
    expect(advanced.rngState).not.toBe(state.rngState);
    expect(step(saved, [], 50).state.rngState).toBe(saved.rngState);
    expect(state.rngState).toBe(42);
  });
});
