import { describe, expect, it } from 'vitest';
import { encounterClockText, formatElapsedTicks } from '../src/encounter-clock';
import { room } from './fixtures';

describe('encounter clock', () => {
  it.each([[0, '00:00'], [1, '00:00'], [19, '00:00'], [20, '00:01'], [1199, '00:59'],
    [1200, '01:00'], [6500, '05:25'], [9600, '08:00'], [120000, '100:00']])('formats %s ticks as %s', (ticks, expected) => {
    expect(formatElapsedTicks(Number(ticks))).toBe(expected);
  });

  it.each([[1, 'Los nueve ríos'], [2, 'Los guías'], [3, 'Río Apanohuaya']] as const)('shows phase %s from core', (phase, name) => {
    expect(encounterClockText(room([], { tick: 100000, elapsedTicks: 1200, phase }))).toBe(`01:00 · Fase ${phase}: ${name}`);
  });

  it('hides in the lobby and retains the final elapsed time at the result', () => {
    expect(encounterClockText(room([], { status: 'lobby' }))).toBe('');
    expect(encounterClockText(room([], { status: 'victory', elapsedTicks: 6500 }))).toBe('05:25 · Fase 1: Los nueve ríos');
  });
});
