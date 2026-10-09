import { expect, test } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { accumulateAttemptEvents, createAttemptSummary, syncAttemptSnapshot } from '../src/attempt-summary';
import { attemptEvents, attemptSnapshot } from './attempt-fixtures';

test('createAttemptSummary starts independent empty attempts', () => {
  const first = createAttemptSummary();
  expect(first).toEqual({ totals: new Map(), pending: new Map() });
  expect(createAttemptSummary()).not.toBe(first);
});

test('accumulation adds damage and effective healing across batches without changing the input', () => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  const first = accumulateAttemptEvents(initial, attemptEvents.slice(0, 1));
  const summary = accumulateAttemptEvents(first, attemptEvents.slice(1));
  expect(summary.totals.get('self')).toMatchObject({ damage: 245, healing: 0 });
  expect(summary.totals.get('healer')).toMatchObject({ damage: 0, healing: 130 });
  expect(initial.totals.size).toBe(0);
  expect(first.totals.get('self')?.damage).toBe(140);
  expect(first.totals.get('self')?.cancelled).toEqual({});
});

test('groups cancellations and rejections by source and reason', () => {
  const summary = accumulateAttemptEvents(syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot), attemptEvents);
  expect(summary.totals.get('self')?.cancelled).toEqual({ moving: 2, flight: 1 });
  expect(summary.totals.get('self')?.rejected).toEqual({ cooldown: 2, out_of_range: 1 });
  expect(summary.totals.get('healer')?.cancelled).toEqual({});
});

test('counts only boss hits by target and ability, including repeated auto attacks', () => {
  const summary = accumulateAttemptEvents(syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot), attemptEvents);
  expect(summary.totals.get('self')?.bossHits).toEqual(new Map([
    ['autoAttack', { hits: 2, total: 120 }], ['flayedStrike', { hits: 1, total: 400 }],
  ]));
  expect(summary.totals.get('healer')?.bossHits.size).toBe(0);
});

test('uses death event attribution, even when the preceding damage came from someone else', () => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  const summary = accumulateAttemptEvents(initial, attemptEvents);
  expect(summary.totals.get('self')?.death).toEqual({ abilityId: 'unsafeGround', sourceId: 'environment' });
  expect(summary.totals.get('healer')?.death).toBeUndefined();
});

test.each([undefined, null, {}, { status: 'combat' }, { status: 'combat', players: {} }])(
  'buffers early events and ignores incomplete snapshot %j', (snapshot) => {
    const early = accumulateAttemptEvents(createAttemptSummary(), attemptEvents);
    expect(syncAttemptSnapshot(early, snapshot)).toBe(early);
    expect(early.totals.size).toBe(0);
    const synced = syncAttemptSnapshot(early, attemptSnapshot);
    expect(synced.totals.get('self')?.damage).toBe(245);
    expect(synced.pending.size).toBe(0);
  },
);

test('preserves early events through initial and repeated lobby patches until combat', () => {
  const early = accumulateAttemptEvents(createAttemptSummary(), attemptEvents);
  const lobby = { ...attemptSnapshot, status: 'lobby' as const };
  const waiting = syncAttemptSnapshot(syncAttemptSnapshot(early, lobby), lobby);
  expect(syncAttemptSnapshot(waiting, attemptSnapshot).totals.get('self')?.damage).toBe(245);
});

test.each(['victory', 'defeat'] as const)('retains %s totals, accepts late events and clears on lobby', (status) => {
  const early = accumulateAttemptEvents(createAttemptSummary(), attemptEvents.slice(0, 1));
  const result = syncAttemptSnapshot(early, { ...attemptSnapshot, status });
  const repeated = syncAttemptSnapshot(result, { ...attemptSnapshot, status, entities: {} });
  expect(repeated.totals.get('self')?.damage).toBe(140);
  expect(repeated.snapshot?.entities).toEqual(attemptSnapshot.entities);
  const late = accumulateAttemptEvents(repeated, attemptEvents.slice(1));
  expect(late.totals.get('self')?.damage).toBe(245);
  const reset = syncAttemptSnapshot(late, { ...attemptSnapshot, status: 'lobby', entities: {} });
  expect(reset.totals.size).toBe(0);
  expect(reset.pending.size).toBe(0);
  expect(reset.snapshot?.entities).toEqual({});
});

test('resets at a new combat and does not reset on consecutive combat patches', () => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  const previous = accumulateAttemptEvents(initial, attemptEvents);
  expect(syncAttemptSnapshot(previous, attemptSnapshot).totals).toEqual(previous.totals);
  const ended = syncAttemptSnapshot(previous, { ...attemptSnapshot, status: 'defeat' });
  expect(syncAttemptSnapshot(ended, attemptSnapshot).totals.size).toBe(0);
  const lobby = syncAttemptSnapshot(ended, { ...attemptSnapshot, status: 'lobby' });
  const early = accumulateAttemptEvents(lobby, attemptEvents.slice(0, 1));
  expect(syncAttemptSnapshot(early, attemptSnapshot).totals.get('self')?.damage).toBe(140);
});

test.each<CombatEvent>([
  { type: 'phaseChanged', tick: 1, phase: 2 }, { type: 'enraged', tick: 1, sourceId: 'boss' },
  { type: 'encounterEnded', tick: 1, outcome: 'defeat' },
  { type: 'castStarted', tick: 1, sourceId: 'self', targetId: 'boss', abilityId: 'obsidianArrow', durationTicks: 40 },
  { type: 'castFinished', tick: 1, sourceId: 'self', targetId: 'boss', abilityId: 'obsidianArrow' },
  { type: 'abilityResolved', tick: 1, sourceId: 'self', targetId: 'boss', abilityId: 'obsidianArrow' },
])('ignores non-statistical event $type', (event) => {
  const initial = syncAttemptSnapshot(createAttemptSummary(), attemptSnapshot);
  expect(accumulateAttemptEvents(initial, [event]).totals.size).toBe(0);
});
