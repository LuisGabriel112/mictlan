import { expect, test } from 'vitest';
import { BOSS, CLASSES, COMBAT_RULES } from '../src/index.js';
import { advancePlayerAutoAttack } from '../src/enemy.js';
import { combatEncounter, combatPlayer, readyCast } from './combat-fixtures.js';

const SECONDS = COMBAT_RULES.ticksPerSecond;

test.each([['eagle', 15], ['healer', 10]] as const)('SPEC §11: %s auto-attacks for %i every 2 s up to 30 m', (classId, damage) => {
  expect(CLASSES[classId].autoAttack).toEqual({ abilityId: 'autoAttack', baseDamage: damage, intervalTicks: 2 * SECONDS,
    rangeMeters: COMBAT_RULES.rangedRangeMeters });
});

test('SPEC §11: Flecha de obsidiana casts in 1.5 s and Gran remedio in 2.0 s', () => {
  expect(CLASSES.eagle.abilities.find(({ id }) => id === 'obsidianArrow')?.castTicks).toBe(1.5 * SECONDS);
  expect(CLASSES.healer.abilities.find(({ id }) => id === 'greatRemedy')?.castTicks).toBe(2 * SECONDS);
});

function rangedSetup(distance: number) {
  const state = combatEncounter();
  const boss = state.entities[BOSS.id];
  Object.assign(combatPlayer(state), { x: boss.x + distance + BOSS.bodyRadiusMeters, y: boss.y, targetId: BOSS.id, autoAttackRemainingTicks: 0 });
  return state;
}

test('the Águila hits the selected boss from range', () => {
  const result = advancePlayerAutoAttack(rangedSetup(25), 'p3');
  expect(result.events[0]).toMatchObject({ type: 'damage', sourceId: 'p3', targetId: BOSS.id, abilityId: 'autoAttack', amount: 15 });
  expect(combatPlayer(result.state).autoAttackRemainingTicks).toBe(2 * SECONDS);
});

test('ranged auto-attacks stop past 30 m and pause while casting', () => {
  expect(advancePlayerAutoAttack(rangedSetup(31), 'p3').events).toEqual([]);
  const casting = rangedSetup(10);
  readyCast(casting, 'obsidianArrow', 'p3', BOSS.id);
  combatPlayer(casting).cast!.remainingTicks = 10;
  expect(advancePlayerAutoAttack(casting, 'p3').events).toEqual([]);
});
