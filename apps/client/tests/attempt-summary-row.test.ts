import { expect, test } from 'vitest';
import type { CastCancellationReason, AbilityRejectionReason } from '@mictlan/core';
import { accumulateAttemptEvents, createAttemptSummary, syncAttemptSnapshot } from '../src/attempt-summary';
import { attemptSummaryRows, BOT_REFERENCE_TEXT } from '../src/attempt-summary-row';
import { attemptEvents, attemptSnapshot } from './attempt-fixtures';

test('formats every column, Spanish names, precise rates, self and idle players', () => {
  const summary = accumulateAttemptEvents(syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot), attemptEvents);
  const rows = attemptSummaryRows(summary, 'self');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toEqual({ self: true, cells: ['Guerrero Águila (tú)', '245', '24,5', '0', '0,0',
    '3 · Movimiento: 2 · Vuelo: 1', '3 · En recarga: 2 · Fuera de alcance: 1',
    'Ataque: 2 golpes / 120 daño · Golpe del Descarnado: 1 golpe / 400 daño', 'Río Apanohuaya — Entorno'] });
  expect(rows[1]).toEqual({ self: false, cells: ['Tícitl', '0', '0,0', '130', '13,0', '0', '0', '—', '—'] });
  expect(rows[2]).toEqual({ self: false, cells: ['Guerrero Jaguar', '0', '0,0', '0', '0,0', '0', '0', '—', '—'] });
});

test.each([0, 1, 21])('DPS and HPS use exact elapsed ticks (%i) without rounding seconds', (elapsedTicks) => {
  const summary = accumulateAttemptEvents(syncAttemptSnapshot(createAttemptSummary(), { ...attemptSnapshot, elapsedTicks }), attemptEvents);
  const rows = attemptSummaryRows(summary, 'healer');
  const expected = elapsedTicks === 0 ? ['0,0', '0,0'] : elapsedTicks === 1 ? ['4900,0', '2600,0'] : ['233,3', '123,8'];
  expect([rows[0].cells[2], rows[1].cells[4]]).toEqual(expected);
  expect(rows[1].cells[0]).toBe('Tícitl (tú)');
});

test('no rows before synchronization or in the lobby', () => {
  expect(attemptSummaryRows(createAttemptSummary(), 'self')).toEqual([]);
  const summary = syncAttemptSnapshot(createAttemptSummary(), { ...attemptSnapshot, status: 'lobby' });
  expect(attemptSummaryRows(summary, 'self')).toEqual([]);
});

test.each<CastCancellationReason>(['moving', 'flight', 'dodge', 'interrupted', 'invalid_target', 'out_of_range'])(
  'formats cancellation %s in Spanish', (reason) => {
    const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
    const summary = accumulateAttemptEvents(initial, [{ type: 'castCancelled', tick: 1, sourceId: 'self', abilityId: 'obsidianArrow', reason }]);
    const labels = { moving: 'Movimiento', flight: 'Vuelo', dodge: 'Esquiva', interrupted: 'Interrupción', invalid_target: 'Objetivo inválido', out_of_range: 'Fuera de alcance' };
    expect(attemptSummaryRows(summary, 'self')[0].cells[5]).toBe(`1 · ${labels[reason]}: 1`);
  },
);

test.each<[AbilityRejectionReason, string]>([
  ['dead', 'Estás muerto'], ['casting', 'Ya estás casteando'], ['gcd', 'Aún no está lista'], ['cooldown', 'En recarga'],
  ['insufficient_mana', 'Sin maná'], ['invalid_target', 'Objetivo inválido'], ['out_of_range', 'Fuera de alcance'],
  ['moving', 'No puedes castear en movimiento'], ['not_casting', 'El objetivo no está casteando'],
])('formats rejection %s in Spanish', (reason, label) => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  const summary = accumulateAttemptEvents(initial, [{ type: 'abilityRejected', tick: 1, sourceId: 'self', abilityId: 'quickShot', reason }]);
  expect(attemptSummaryRows(summary, 'self')[0].cells[6]).toBe(`1 · ${label}: 1`);
});

test.each([
  ['boss', 'flayedStrike', 'Golpe del Descarnado — Mictlantecuhtli'],
  ['xolo', 'autoAttack', 'Ataque — Xolo espectral'],
  ['self', 'disconnect', 'Desconexión — Guerrero Águila (tú)'],
] as const)('death names %s and its ability', (sourceId, abilityId, expected) => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  const summary = accumulateAttemptEvents(initial, [{ type: 'death', tick: 1, entityId: 'self', sourceId, abilityId }]);
  expect(attemptSummaryRows(summary, 'self')[0].cells[8]).toBe(expected);
});

test('bot reference stays identical to the requested simulator comparison', () => {
  expect(BOT_REFERENCE_TEXT).toBe('Referencia de bots perfectos (3 jugadores): Jaguar 25 DPS · Águila 58 DPS · Tícitl 27 HPS');
});
