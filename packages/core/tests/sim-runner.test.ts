import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import * as core from '../src/index.js';
import { runEncounter } from '../sim/runner.js';
import type { RunEncounterResult } from '../sim/runner.js';

const cases = ([3, 4, 5] as const).flatMap((players) => [1, 42, 2026].map((seed) => ({ players, seed })));
const results = new Map<string, RunEncounterResult>();

beforeAll(() => {
  for (const options of cases) results.set(`${options.players}:${options.seed}`, runEncounter(options));
}, 30000);

afterEach(() => vi.restoreAllMocks());

test.each(cases)('C1: $players players, seed $seed reach victory or defeat', ({ players, seed }) => {
  const result = results.get(`${players}:${seed}`);
  expect(result).toBeDefined();
  if (!result) throw new Error('Falta el resultado del encuentro.');
  expect(['victory', 'defeat']).toContain(result.state.status);
  expect(result.ticks).toBeGreaterThan(0);
  expect(result.ticks).toBeLessThanOrEqual(core.SIMULATION_RULES.maxTicks);
  expect(result.state.tick).toBe(result.ticks);
  expect(result.events.filter((event) => event.type === 'encounterEnded')).toEqual([
    { type: 'encounterEnded', tick: result.ticks, outcome: result.state.status },
  ]);
  expect(result.events.some((event) => event.type === 'damage')).toBe(true);
  expect(result.events.every((event, index) => event.tick >= (result.events[index - 1]?.tick ?? 0))).toBe(true);
});

test('C2: the same seed reproduces final state, every event and tick count', () => {
  for (const players of [3, 4, 5] as const) {
    expect(runEncounter({ players, seed: 42 })).toEqual(results.get(`${players}:42`));
  }
});

test('C4: bots never produce a cast rejected for moving across compositions and seeds', () => {
  for (const result of results.values()) {
    expect(result.events.some((event) => event.type === 'castStarted'
      && event.abilityId === 'obsidianArrow')).toBe(true);
    expect(result.events.some((event) => event.type === 'abilityResolved'
      && event.abilityId === 'obsidianWind')).toBe(true);
    expect(result.events.filter((event) => event.type === 'abilityRejected' && event.reason === 'moving')).toEqual([]);
  }
});

test('passes an explicit zero crit chance through to core', () => {
  const result = runEncounter({ players: 3, seed: 7, critChance: 0 });
  expect(result.state.critChance).toBe(0);
  expect(result.events.filter((event) => (event.type === 'damage' || event.type === 'healing') && event.critical)).toEqual([]);
});

test('throws after 18000 ticks if an encounter cannot end', () => {
  const stalled = vi.spyOn(core, 'step').mockImplementation((state) => ({
    state: { ...state, tick: state.tick + 1 }, events: [],
  }));
  expect(() => runEncounter({ players: 3, seed: 1 })).toThrow('18000 ticks');
  expect(stalled).toHaveBeenCalledTimes(18000);
});
