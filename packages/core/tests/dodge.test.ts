import { expect, test } from 'vitest';
import { BOSS, COMBAT_RULES, COMMON_ABILITIES, DODGE } from '../src/index.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, readyCast } from './combat-fixtures.js';

test('SPEC §11: Esquiva is a common 4 m, off-GCD, free dash with an 8 s cooldown', () => {
  expect(DODGE).toMatchObject({ id: 'dodge', name: 'Esquiva', targetType: 'none', manaCost: 0, castTicks: 0,
    triggersGcd: false, rangeMeters: null, cooldownTicks: 8 * COMBAT_RULES.ticksPerSecond,
    effect: { type: 'dash', distanceMeters: 4 } });
  expect(COMMON_ABILITIES).toEqual([DODGE]);
});

test.each(['p1', 'p2', 'p3'])('%s dodges 4 m along its facing and starts the cooldown', (playerId) => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state, playerId), { x: 0, y: 0, facing: { x: 0, y: -1 } });
  const result = combatTick(state, [combatCast('dodge', playerId)]);
  expect(combatPlayer(result.state, playerId)).toMatchObject({ x: 0, y: -4, cooldowns: { dodge: 160 } });
  expect(result.events).toContainEqual({ type: 'abilityResolved', tick: 1, sourceId: playerId, abilityId: 'dodge', targetId: null });
});

test('Esquiva works during the GCD and is rejected while on cooldown', () => {
  const state = combatEncounter();
  combatPlayer(state).gcdRemainingTicks = 10;
  const first = combatTick(state, [combatCast('dodge')]);
  expect(combatPlayer(first.state).cooldowns.dodge).toBe(160);
  const second = combatTick(first.state, [combatCast('dodge')]);
  expect(second.events).toEqual([{ type: 'abilityRejected', tick: 2, sourceId: 'p3', abilityId: 'dodge', reason: 'cooldown' }]);
});

test('Esquiva cancels the own cast with its own reason and stops at the wall', () => {
  const state = combatEncounter();
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  combatPlayer(state).cast!.remainingTicks = 10;
  Object.assign(combatPlayer(state), { x: 18, y: 0, facing: { x: 1, y: 0 } });
  const result = combatTick(state, [combatCast('dodge')]);
  expect(result.events[0]).toEqual({ type: 'castCancelled', tick: 1, sourceId: 'p3', abilityId: 'obsidianArrow', reason: 'dodge' });
  expect(combatPlayer(result.state)).toMatchObject({ x: COMBAT_RULES.arena.wallRadiusMeters, cast: null });
});

test('Flight still reports its own cancellation reason', () => {
  const state = combatEncounter();
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  combatPlayer(state).cast!.remainingTicks = 10;
  expect(combatTick(state, [combatCast('flight')]).events[0]).toMatchObject({ reason: 'flight' });
});

test('dead players cannot dodge', () => {
  const state = combatEncounter();
  combatPlayer(state, 'p1').health = 0;
  const result = combatTick(state, [combatCast('dodge', 'p1')]);
  expect(result.events).toEqual([{ type: 'abilityRejected', tick: 1, sourceId: 'p1', abilityId: 'dodge', reason: 'dead' }]);
});
