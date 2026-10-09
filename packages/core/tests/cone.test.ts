import { expect, test } from 'vitest';
import { advanceBossAbilities } from '../src/boss.js';
import { BOSS, BOSS_ABILITIES } from '../src/data/boss.js';
import { aimCone, insideCone } from '../src/mechanics/cone.js';
import type { EncounterState } from '../src/types.js';
import { combatEncounter, combatPlayer } from './combat-fixtures.js';

const strike = BOSS_ABILITIES.flayedStrike;

test('SPEC §11: Golpe del Descarnado is a 90°, 8 m frontal cone of 400 that cannot be interrupted', () => {
  expect(strike).toMatchObject({ castTicks: 50, interruptible: false,
    effect: { type: 'cone', baseDamage: 400, angleDegrees: 90, lengthMeters: 8 } });
});

test('the cone aims from the boss toward its target, or north without a distinct target', () => {
  expect(aimCone({ x: 1, y: 1 }, { x: 4, y: 5 })).toEqual({ x: 1, y: 1, dx: 0.6, dy: 0.8 });
  expect(aimCone({ x: 1, y: 1 }, undefined)).toEqual({ x: 1, y: 1, dx: 0, dy: 1 });
  expect(aimCone({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1, dx: 0, dy: 1 });
});

test.each([
  [{ x: 0, y: 5 }, 0.5, true], [{ x: 5.5, y: 5.5 }, 0.5, true], [{ x: 0, y: 8.4 }, 0.5, true],
  [{ x: 0, y: 8.6 }, 0.5, false], [{ x: 5.5, y: 5 }, 0, false], [{ x: 5.5, y: 5 }, 0.5, true], [{ x: 6, y: 5 }, 0.5, false],
  [{ x: 0, y: -2 }, 0.5, false], [{ x: 0, y: 0 }, 0.5, true],
] as const)('point %j with body %s is inside: %s', (point, radius, inside) => {
  const aim = { x: 0, y: 0, dx: 0, dy: 1 };
  expect(insideCone(aim, strike.effect, point, radius)).toBe(inside);
});

function startStrike(): EncounterState {
  const state = combatEncounter();
  state.bossActive = true;
  state.bossAbilityTimers = { flayedStrike: 1 };
  const boss = state.entities[BOSS.id];
  Object.assign(boss, { x: 0, y: 0, targetId: 'p1', autoAttackRemainingTicks: 1_000_000 });
  Object.assign(combatPlayer(state, 'p1'), { x: 0, y: 4 });
  Object.assign(combatPlayer(state, 'p2'), { x: 0, y: -10 });
  Object.assign(combatPlayer(state, 'p3'), { x: 2, y: 6 });
  return advanceBossAbilities(state).state;
}

test('starting the strike fixes the cone toward the target on the cast', () => {
  expect(startStrike().entities[BOSS.id].cast).toMatchObject({ abilityId: 'flayedStrike', aim: { x: 0, y: 0, dx: 0, dy: 1 } });
});

test('when the cast ends, every living player inside the fixed cone takes the hit; others are spared', () => {
  let state = startStrike();
  // The tank runs away mid-cast: the cone stays where it was marked.
  Object.assign(state.entities.p1, { x: 0, y: -15 });
  Object.assign(state.entities.p2, { x: -1, y: 3 });
  const hits: string[] = [];
  for (let tick = 0; tick < strike.castTicks; tick += 1) {
    const result = advanceBossAbilities(state);
    state = result.state;
    for (const event of result.events) if (event.type === 'damage') hits.push(`${event.targetId}:${event.amount}`);
  }
  expect(hits).toEqual(['p2:400', 'p3:400']);
  expect(state.entities[BOSS.id].cast).toBeNull();
});

test('dead players inside the cone are skipped and the Jaguar armor still applies', () => {
  let state = startStrike();
  state.entities.p3 = { ...state.entities.p3, health: 0 };
  for (let tick = 0; tick < strike.castTicks; tick += 1) state = advanceBossAbilities(state).state;
  expect(state.entities.p3.health).toBe(0);
  expect(state.entities.p1.health).toBe(state.entities.p1.maxHealth - 280);
});
