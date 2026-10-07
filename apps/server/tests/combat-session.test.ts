import { expect, test, vi } from 'vitest';
import { createEncounter, step, type EncounterState } from '@mictlan/core';
import { CombatSession, type CoreStep } from '../src/combat-session.js';

function encounter(): EncounterState {
  return createEncounter({ players: [{ id: 'p1', classId: 'eagle' }], devMode: true, critChance: 0 }, 7);
}

test('queued inputs reach exactly the next step and no later one', () => {
  const coreStep = vi.fn(step);
  const session = new CombatSession(encounter(), coreStep);
  session.receive('p1', 'target', { entityId: 'boss' });
  session.receive('p1', 'move', { dx: 0, dy: 1 });
  session.advance(100);
  expect(coreStep).toHaveBeenCalledTimes(2);
  expect(coreStep.mock.calls[0][1]).toEqual([
    { playerId: 'p1', type: 'target', entityId: 'boss' }, { playerId: 'p1', type: 'move', dx: 0, dy: 1 },
  ]);
  expect(coreStep.mock.calls[1][1]).toEqual([]);
  expect(coreStep.mock.calls.every((call) => call[2] === 50)).toBe(true);
});

test('inputs from players outside the encounter or malformed payloads are dropped', () => {
  const coreStep = vi.fn(step);
  const session = new CombatSession(encounter(), coreStep);
  session.receive('stranger', 'move', { dx: 1, dy: 0 });
  session.receive('p1', 'move', { dx: Number.NaN, dy: 0 });
  session.receive('p1', 'cast', 'obsidianArrow');
  session.advance(50);
  expect(coreStep.mock.calls[0][1]).toEqual([]);
});

test('a move of length 3 moves exactly like a move of length 1', () => {
  const long = new CombatSession(encounter(), step);
  const unit = new CombatSession(encounter(), step);
  long.receive('p1', 'move', { dx: 3, dy: 0 });
  unit.receive('p1', 'move', { dx: 1, dy: 0 });
  long.advance(50);
  unit.advance(50);
  expect(long.state.entities.p1).toMatchObject({ x: unit.state.entities.p1.x, y: unit.state.entities.p1.y });
  expect(long.state.entities.p1.x).not.toBe(encounter().entities.p1.x);
});

test('advance returns the events of every step it ran', () => {
  const session = new CombatSession(encounter(), step);
  session.receive('p1', 'cast', { abilityId: 'flight' });
  const events = session.advance(50);
  expect(events).toContainEqual(expect.objectContaining({ type: 'abilityResolved', abilityId: 'flight' }));
});

test('the session stops stepping once core reports the end', () => {
  const ended = { ...encounter(), status: 'victory' as const };
  const coreStep = vi.fn<CoreStep>(() => ({ state: ended, events: [] }));
  const session = new CombatSession(encounter(), coreStep);
  session.advance(200);
  expect(coreStep).toHaveBeenCalledOnce();
  expect(session.finished).toBe(true);
  session.receive('p1', 'move', { dx: 1, dy: 0 });
  session.advance(200);
  expect(coreStep).toHaveBeenCalledOnce();
  expect(session.state).toBe(ended);
});

test('elapsed time below one tick does not step', () => {
  const coreStep = vi.fn(step);
  const session = new CombatSession(encounter(), coreStep);
  expect(session.advance(30)).toEqual([]);
  expect(coreStep).not.toHaveBeenCalled();
  session.advance(20);
  expect(coreStep).toHaveBeenCalledOnce();
});
