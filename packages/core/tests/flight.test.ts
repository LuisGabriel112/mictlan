import { expect, test } from 'vitest';
import { usePlayerAbility } from '../src/abilities.js';
import { BOSS } from '../src/index.js';
import type { Input } from '../src/index.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';

test.each([[], [{ type: 'move', playerId: 'p3', dx: 0, dy: 0 }]] satisfies Input[][])(
  'C5: stationary Flight travels 8 meters along facing', (...inputs) => {
    const state = combatEncounter();
    Object.assign(combatPlayer(state), { x: 0, y: 0, facing: { x: 0, y: 1 } });
    const result = combatTick(state, [...inputs, combatCast('flight')]);
    expect(combatPlayer(result.state)).toMatchObject({ x: 0, y: 8, facing: { x: 0, y: 1 } });
    expect(combatPlayer(result.state).facing).toBe(combatPlayer(state).facing);
  },
);

test('C5: Flight adds 8 meters after the last move, regardless of input arrival order', () => {
  const state = combatEncounter();
  Object.assign(combatPlayer(state), { x: 0, y: 0, facing: { x: 0, y: 1 } });
  const result = combatTick(state, [combatCast('flight'),
    { type: 'move', playerId: 'p3', dx: -1, dy: 0 }, { type: 'move', playerId: 'p3', dx: 3, dy: 4 },
  ]);
  expect(combatPlayer(result.state).x).toBeCloseTo(8.35 * 0.6, 12);
  expect(combatPlayer(result.state).y).toBeCloseTo(8.35 * 0.8, 12);
  expect(combatPlayer(result.state).facing).toEqual({ x: 0.6, y: 0.8 });
});

test('C6: Flight clamps the center to exactly 20 meters, independently of the safe radius', () => {
  const state = combatEncounter();
  state.safeRadiusMeters = 12;
  Object.assign(combatPlayer(state), { x: 19, y: 0, facing: { x: 1, y: 0 } });
  const result = combatTick(state, [combatCast('flight')]);
  expect(combatPlayer(result.state)).toMatchObject({ x: 20, y: 0 });
  expect(Math.hypot(combatPlayer(result.state).x, combatPlayer(result.state).y)).toBe(20);
});

test('C7: Flight cancels Arrow without its cost or cooldown and starts 240 ticks of cooldown', () => {
  const state = combatEncounter();
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  combatPlayer(state).cast!.remainingTicks = 10;
  combatPlayer(state).gcdRemainingTicks = 10;
  const result = combatTick(state, [combatCast('flight')]);
  expect(result.events).toEqual([
    { type: 'castCancelled', tick: 1, sourceId: 'p3', abilityId: 'obsidianArrow', reason: 'flight' },
    { type: 'abilityResolved', tick: 1, sourceId: 'p3', abilityId: 'flight', targetId: null },
  ]);
  expect(combatPlayer(result.state)).toMatchObject({ cast: null, mana: 0, cooldowns: { flight: 240 }, gcdRemainingTicks: 9 });
  let current = result.state;
  for (let tick = 0; tick < 40; tick += 1) current = combatTick(current).state;
  expect(current.entities[BOSS.id].health).toBe(state.entities[BOSS.id].health);
});

test('Flight itself preserves facing, cancels before resolving, and leaves GCD alone', () => {
  const state = combatEncounter();
  const source = combatPlayer(state);
  freezeCombat(state);
  const result = usePlayerAbility(source, 'flight', state.entities, false, 1);
  expect(result.player.facing).toBe(source.facing);
  expect(result.player.gcdRemainingTicks).toBe(0);
  expect(result.player.cooldowns.flight).toBe(240);
  expect(state.entities.p3).toBe(source);
});

test('rejected Flight does not cancel an active cast or displace the player', () => {
  const state = combatEncounter();
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  combatPlayer(state).cast!.remainingTicks = 10;
  combatPlayer(state).cooldowns.flight = 2;
  const result = combatTick(state, [combatCast('flight')]);
  expect(result.events).toEqual([{ type: 'abilityRejected', tick: 1, sourceId: 'p3', abilityId: 'flight', reason: 'cooldown' }]);
  expect(combatPlayer(result.state).cast?.remainingTicks).toBe(9);
  expect(combatPlayer(result.state).x).toBe(combatPlayer(state).x);
});

test('the first cast wins over Flight and a completing Arrow resolves before Flight', () => {
  const state = combatEncounter();
  combatPlayer(state).targetId = BOSS.id;
  const first = combatTick(state, [combatCast('obsidianArrow'), combatCast('flight')]);
  expect(combatPlayer(first.state).cooldowns.flight).toBeUndefined();
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  const finished = combatTick(state, [combatCast('flight')]);
  expect(finished.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'damage', 'abilityResolved']);
  expect(finished.state.entities[BOSS.id].health).toBe(23860);
});
