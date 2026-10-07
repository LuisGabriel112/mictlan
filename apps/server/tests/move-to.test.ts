import { describe, expect, test, vi } from 'vitest';
import { BOSS, COMBAT_RULES, createEncounter, removePlayer, step, type EncounterState } from '@mictlan/core';
import { CombatSession } from '../src/combat-session.js';
import { parseDestination } from '../src/inputs.js';

const STEP = COMBAT_RULES.playerSpeedMetersPerSecond / COMBAT_RULES.ticksPerSecond;

function encounter(): EncounterState {
  return createEncounter({ players: [{ id: 'p1', classId: 'eagle' }], devMode: true, critChance: 0 }, 7);
}

function session() {
  const coreStep = vi.fn(step);
  return { coreStep, session: new CombatSession(encounter(), coreStep, removePlayer) };
}

function position(current: CombatSession) {
  const { x, y } = current.state.entities.p1;
  return { x, y };
}

describe('parseDestination', () => {
  test('accepts finite coordinates', () => {
    expect(parseDestination({ x: 3, y: -4.5 })).toEqual({ x: 3, y: -4.5 });
  });

  test.each([
    { x: Number.NaN, y: 0 }, { x: Number.POSITIVE_INFINITY, y: 0 }, { x: 1 }, { x: '1', y: 0 }, null, [], 'here',
  ])('rejects %j', (payload) => {
    expect(parseDestination(payload)).toBeUndefined();
  });
});

describe('moveTo', () => {
  test('walks toward the destination every tick without new messages', () => {
    const { session: current } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.advance(150);
    expect(position(current).x).toBeCloseTo(0, 9);
    expect(position(current).y).toBeCloseTo(-15 + 3 * STEP, 9);
  });

  test('stops within one step of the destination and stays there', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -14 });
    for (let index = 0; index < 10; index += 1) current.advance(50);
    expect(Math.abs(position(current).y - -14)).toBeLessThan(STEP);
    const settled = position(current);
    current.advance(100);
    expect(position(current)).toEqual(settled);
    expect(coreStep.mock.calls.at(-1)?.[1]).toEqual([]);
  });

  test('a destination beyond the wall stops at the wall instead of pushing forever', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -50 });
    for (let index = 0; index < 40; index += 1) current.advance(50);
    expect(position(current).y).toBeCloseTo(-COMBAT_RULES.arena.wallRadiusMeters, 0);
    expect(coreStep.mock.calls.at(-1)?.[1]).toEqual([]);
  });

  test('invalid destinations are ignored', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: Number.NaN, y: 0 });
    current.receive('stranger', 'moveTo', { x: 0, y: 0 });
    current.advance(50);
    expect(coreStep.mock.calls[0][1]).toEqual([]);
  });

  test('a new destination replaces the old one', () => {
    const { session: current } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.receive('p1', 'moveTo', { x: 5, y: -15 });
    current.advance(50);
    expect(position(current).x).toBeCloseTo(STEP, 9);
    expect(position(current).y).toBeCloseTo(-15, 9);
  });

  test('a destination replaces a held direction', () => {
    const { session: current } = session();
    current.receive('p1', 'move', { dx: 1, dy: 0 });
    current.receive('p1', 'moveTo', { x: 0, y: -14.5 });
    current.advance(50);
    expect(position(current).x).toBeCloseTo(0, 9);
    expect(position(current).y).toBeCloseTo(-15 + STEP, 9);
    const arrived = position(current);
    current.advance(100);
    expect(position(current)).toEqual(arrived);
  });

  test('an arrived destination is forgotten, so a later dash does not walk back', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -14.8 });
    current.advance(100);
    current.receive('p1', 'cast', { abilityId: 'flight' });
    current.advance(100);
    expect(coreStep.mock.calls.at(-1)?.[1]).toEqual([]);
  });

  test('a direction move forgets the destination', () => {
    const { session: current } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.receive('p1', 'move', { dx: 1, dy: 0 });
    current.advance(50);
    expect(position(current)).toEqual({ x: STEP, y: -15 });
  });

  test('stop cancels the destination and any held direction', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.advance(50);
    current.receive('p1', 'stop', {});
    current.advance(50);
    expect(coreStep.mock.calls[1][1]).toEqual([]);
    current.receive('p1', 'move', { dx: 1, dy: 0 });
    current.receive('p1', 'stop', null);
    current.advance(50);
    expect(coreStep.mock.calls[2][1]).toEqual([]);
  });
});

describe('casting while walking', () => {
  test('a cast-time ability stops movement so the cast starts', () => {
    const { session: current } = session();
    current.receive('p1', 'target', { entityId: BOSS.id });
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.advance(50);
    current.receive('p1', 'cast', { abilityId: 'obsidianArrow' });
    const events = current.advance(50);
    expect(events).toContainEqual(expect.objectContaining({ type: 'castStarted', abilityId: 'obsidianArrow' }));
    const before = position(current);
    current.advance(100);
    expect(position(current)).toEqual(before);
  });

  test('a cast-time ability also releases a held direction', () => {
    const { session: current } = session();
    current.receive('p1', 'target', { entityId: BOSS.id });
    current.receive('p1', 'move', { dx: 1, dy: 0 });
    current.advance(50);
    current.receive('p1', 'cast', { abilityId: 'obsidianArrow' });
    expect(current.advance(50)).toContainEqual(expect.objectContaining({ type: 'castStarted' }));
  });

  test('instant abilities keep walking toward the destination', () => {
    const { session: current } = session();
    current.receive('p1', 'moveTo', { x: 0, y: 0 });
    current.advance(50);
    current.receive('p1', 'cast', { abilityId: 'flight' });
    current.advance(50);
    const afterDash = position(current).y;
    current.advance(50);
    expect(position(current).y).toBeCloseTo(afterDash + STEP, 9);
  });
});

describe('forgetting destinations', () => {
  test('a disconnect forgets the destination', () => {
    const { session: current, coreStep } = session();
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.disconnect('p1');
    current.advance(50);
    expect(coreStep.mock.calls[0][1]).toEqual([]);
  });

  test('a dead player produces no move input', () => {
    const dead = encounter();
    dead.entities.p1 = { ...dead.entities.p1, health: 0 };
    const coreStep = vi.fn(step);
    const current = new CombatSession(dead, coreStep, removePlayer);
    current.receive('p1', 'moveTo', { x: 0, y: -10 });
    current.advance(50);
    expect(coreStep.mock.calls[0][1]).toEqual([]);
  });
});
