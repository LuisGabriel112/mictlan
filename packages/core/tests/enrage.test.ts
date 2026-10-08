import { expect, test } from 'vitest';
import { resolveDamageEffect } from '../src/combat-effects.js';
import { BOSS, BOSS_ABILITIES, XOLO } from '../src/data/boss.js';
import { advanceBossEnrage, enrageDamageModifiers } from '../src/phases.js';
import { combatCast, combatEncounter, combatTick, freezeCombat } from './combat-fixtures.js';
import { enemyEncounter, repeatTick } from './enemy-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';

test('enrage starts once at elapsedTicks 9600, independently of the absolute tick', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.tick = 12000;
  initial.elapsedTicks = BOSS.enrage.afterTicks - 2;
  const before = combatTick(initial);
  expect(before.state.elapsedTicks).toBe(9599);
  expect(before.state.enraged).toBe(false);
  expect(before.events).toEqual([]);
  const enraged = combatTick(before.state);
  expect(enraged.state.elapsedTicks).toBe(9600);
  expect(enraged.state.enraged).toBe(true);
  expect(enraged.events).toEqual([{ type: 'enraged', sourceId: BOSS.id, tick: 12002 }]);
  const after = repeatTick(enraged.state, 10);
  expect(after.state.enraged).toBe(true);
  expect(after.events).toEqual([]);
});

test('waiting before pull does not advance the enrage clock', () => {
  const initial = combatEncounter();
  initial.tick = BOSS.enrage.afterTicks;
  const waiting = repeatTick(initial, 5);
  expect(waiting.state).toMatchObject({ bossActive: false, elapsedTicks: 0, enraged: false });
  expect(waiting.events).toEqual([]);
  const pulled = combatTick(waiting.state, [
    { type: 'target', playerId: 'p3', entityId: BOSS.id }, combatCast('quickShot'),
  ]);
  expect(pulled.state).toMatchObject({ bossActive: true, elapsedTicks: 1, enraged: false });
  expect(pulled.events.some(({ type }) => type === 'enraged')).toBe(false);
});

test.each(['inactive', 'dead', 'missing'])(
  'enrage does not start for an %s boss', (condition) => {
    const initial = combatEncounter();
    initial.bossActive = condition !== 'inactive';
    initial.elapsedTicks = BOSS.enrage.afterTicks;
    if (condition === 'dead') initial.entities.boss.health = 0;
    if (condition === 'missing') delete initial.entities.boss;
    freezeCombat(initial);
    expect(advanceBossEnrage(initial)).toEqual({ state: initial, events: [] });
    expect(advanceBossEnrage(initial).state).toBe(initial);
    expect(combatTick(initial).state.enraged).toBe(false);
  },
);

test.each([{ targetId: 'p3', normal: 60, enraged: 300 }, { targetId: 'p1', normal: 42, enraged: 210 }])(
  'C4: boss auto-attack against $targetId changes from $normal to $enraged on the enrage tick',
  ({ targetId, normal, enraged }) => {
    const initial = enemyEncounter(targetId);
    initial.elapsedTicks = BOSS.enrage.afterTicks - 2;
    const ordinary = combatTick(initial);
    expect(ordinary.events).toContainEqual({
      type: 'damage', sourceId: BOSS.id, abilityId: 'autoAttack', targetId, amount: normal, critical: false, tick: 1,
    });
    const result = combatTick({ ...initial, elapsedTicks: BOSS.enrage.afterTicks - 1 });
    expect(result.events).toEqual([
      { type: 'enraged', sourceId: BOSS.id, tick: 1 },
      { type: 'damage', sourceId: BOSS.id, abilityId: 'autoAttack', targetId, amount: enraged, critical: false, tick: 1 },
    ]);
    expect(result.state.entities[targetId].health).toBe(initial.entities[targetId].health - enraged);
  },
);

test('C4: xolo auto-attacks still deal 25 while boss auto-attacks deal 300', () => {
  const initial = enemyEncounter('p3');
  initial.elapsedTicks = BOSS.enrage.afterTicks - 1;
  initial.entities.xolo = { ...threatEnemy(initial), id: 'xolo', type: 'xolo' };
  const result = combatTick(initial);
  expect(result.events.filter(({ type }) => type === 'damage')).toEqual([
    { type: 'damage', sourceId: BOSS.id, abilityId: 'autoAttack', targetId: 'p3', amount: 300, critical: false, tick: 1 },
    { type: 'damage', sourceId: 'xolo', abilityId: 'autoAttack', targetId: 'p3', amount: XOLO.autoAttack.baseDamage, critical: false, tick: 1 },
  ]);
});

test('a Strike completing on the enrage tick uses enrage together with a real Shield', () => {
  const initial = enemyEncounter('p1');
  initial.elapsedTicks = BOSS.enrage.afterTicks - 1;
  initial.entities.boss.autoAttackRemainingTicks = 10;
  initial.entities.boss.cast = {
    abilityId: 'flayedStrike', targetId: 'p1', durationTicks: 50, remainingTicks: 1, interruptible: false,
  };
  const result = combatTick(initial, [combatCast('obsidianShield', 'p1')]);
  expect(result.events.filter(({ type }) => type === 'damage')).toEqual([
    { type: 'damage', sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', amount: 700, critical: false, tick: 1 },
  ]);
  expect(result.events.some(({ type }) => type === 'enraged')).toBe(true);
});

test.each(BOSS.enrage.affectedAbilityIds)('enrage is a single damage modifier for %s', (abilityId) => {
  const initial = combatEncounter();
  initial.enraged = true;
  const baseDamage = abilityId === 'autoAttack' ? BOSS.autoAttack.baseDamage : BOSS_ABILITIES[abilityId].effect.baseDamage;
  const result = resolveDamageEffect(initial, { sourceId: BOSS.id, abilityId, tick: 1 }, initial.entities.p3, baseDamage);
  expect(result.events[0]).toMatchObject({ type: 'damage', abilityId, amount: baseDamage * 5, critical: false });
});

test('enrage and armor round down only once after all multipliers', () => {
  const initial = combatEncounter();
  initial.enraged = true;
  initial.entities.p1.armorBps = 3333;
  const result = resolveDamageEffect(initial, { sourceId: BOSS.id, abilityId: 'autoAttack', tick: 1 }, initial.entities.p1, 61);
  // floor(61 * 0.6667 * 5) = 203; flooring before enrage would incorrectly give 200.
  expect(result.events[0]).toMatchObject({ amount: 203, critical: false });
});

test('enrage excludes player attacks, environment and abilities outside the configured list', () => {
  const initial = combatEncounter();
  initial.enraged = true;
  expect(enrageDamageModifiers(initial, 'environment', 'unsafeGround')).toEqual([]);
  expect(enrageDamageModifiers(initial, BOSS.id, 'unsafeGround')).toEqual([]);
  expect(enrageDamageModifiers(initial, BOSS.id, 'callOfTheXolos')).toEqual([]);
  const result = resolveDamageEffect(initial, { sourceId: 'p1', abilityId: 'autoAttack', tick: 1 }, initial.entities.boss, 20);
  expect(result.events[0]).toMatchObject({ sourceId: 'p1', amount: 20, critical: false });
});

test('enrage and phase entry are immutable, deterministic and preserve untouched entities', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.elapsedTicks = BOSS.enrage.afterTicks - 1;
  initial.entities.boss.health = BOSS.maxHealthByPlayerCount[3] * 0.30;
  const original = structuredClone(initial);
  freezeCombat(initial);
  const result = combatTick(initial);
  expect(result.state).toMatchObject({ phase: 3, phaseElapsedTicks: 0, enraged: true });
  expect(result.events).toEqual([
    { type: 'enraged', sourceId: BOSS.id, tick: 1 }, { type: 'phaseChanged', phase: 3, tick: 1 },
  ]);
  expect(result).toEqual(combatTick(initial));
  expect(initial).toEqual(original);
  expect(result.state.entities).toBe(initial.entities);
  expect(advanceBossEnrage(result.state).state).toBe(result.state);
});
