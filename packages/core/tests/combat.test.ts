import { expect, test } from 'vitest';
import { applyDamage, applyHealing, calculateDamage, calculateHealing, rollCritical } from '../src/combat.js';
import { BOSS_ABILITIES, CLASSES, nextRandom } from '../src/index.js';
import { combatEncounter, combatPlayer, freezeCombat } from './combat-fixtures.js';

test('C1: Flayed Strike deals 280 to Jaguar, or 140 with a 5000 Bps modifier', () => {
  const base = BOSS_ABILITIES.flayedStrike.effect.baseDamage;
  expect(calculateDamage(base, CLASSES.jaguar.armorBps, [])).toBe(280);
  expect(calculateDamage(base, CLASSES.jaguar.armorBps, [5000])).toBe(140);
});

test.each([
  { base: 101, armor: 3000, modifiers: [5000, 5000], critical: false, expected: 17 },
  { base: 101, armor: 3000, modifiers: [5000, 5000], critical: true, expected: 26 },
  { base: 100, armor: 0, modifiers: [2900], critical: false, expected: 29 },
  { base: 400, armor: 10000, modifiers: [], critical: false, expected: 1 },
  { base: 0, armor: 0, modifiers: [], critical: false, expected: 1 },
])('damage multiplies all Bps before floor: $expected', ({ base, armor, modifiers, critical, expected }) => {
  expect(calculateDamage(base, armor, modifiers, critical)).toBe(expected);
});

test('C3: healing reports raw and effective amounts and caps health', () => {
  expect(calculateHealing(120, 1180, 1200)).toEqual({ health: 1200, amount: 120, effectiveAmount: 20 });
  expect(calculateHealing(120, 1200, 1200)).toEqual({ health: 1200, amount: 120, effectiveAmount: 0 });
  expect(calculateHealing(101, 1, 1200, true)).toEqual({ health: 152, amount: 151, effectiveAmount: 151 });
});

test('critical rolls advance the injected RNG and respect the strict probability boundary', () => {
  const draw = nextRandom(42);
  expect(rollCritical('player', 42, 0)).toEqual({ rngState: draw.rngState, critical: false });
  expect(rollCritical('player', 42, 1)).toEqual({ rngState: draw.rngState, critical: true });
  expect(rollCritical('player', 42, draw.value)).toEqual({ rngState: draw.rngState, critical: false });
  expect(rollCritical('player', 42, draw.value + Number.EPSILON).critical).toBe(true);
});

test.each(['boss', 'xolo', 'environment'] as const)('%s never crits or consumes RNG', (sourceType) => {
  expect(rollCritical(sourceType, 42, 1)).toEqual({ rngState: 42, critical: false });
});

test.each([40, 41])('lethal damage %s emits damage followed by exactly one death', (amount) => {
  const target = { ...combatPlayer(combatEncounter()), health: 40 };
  const hit = { sourceId: 'enemy', abilityId: 'flayedStrike', amount, critical: false, tick: 2 } as const;
  freezeCombat(target);
  const result = applyDamage(target, hit);
  expect(result.entity.health).toBe(40 - amount);
  expect(result.events).toEqual([
    { type: 'damage', targetId: 'p3', ...hit }, { type: 'death', entityId: 'p3', tick: 2 },
  ]);
  expect(applyDamage(result.entity, hit)).toEqual({ entity: result.entity, events: [] });
  expect(target.health).toBe(40);
});

test('nonlethal damage preserves other state and a living cast', () => {
  const target = combatPlayer(combatEncounter());
  const hit = { sourceId: 'enemy', abilityId: 'flayedStrike', amount: 280, critical: false, tick: 1 } as const;
  const result = applyDamage(target, hit);
  expect(result.entity).toEqual({ ...target, health: 470 });
  expect(result.events).toEqual([{ type: 'damage', targetId: 'p3', ...hit }]);
  expect(result.entity.auras).toBe(target.auras);
});

test('applyHealing preserves full or dead targets and never resurrects', () => {
  const target = combatPlayer(combatEncounter());
  const heal = { sourceId: 'p2', abilityId: 'remedy', amount: 120, critical: false, tick: 1 } as const;
  const full = applyHealing(target, heal);
  expect(full.entity).toBe(target);
  expect(full.events).toEqual([{ type: 'healing', targetId: 'p3', effectiveAmount: 0, ...heal }]);
  const dead = { ...target, health: -1 };
  expect(applyHealing(dead, heal)).toEqual({ entity: dead, events: [] });
  const injured = { ...target, health: 700 };
  expect(applyHealing(injured, heal).entity).toEqual({ ...target, health: 750 });
  expect(injured.health).toBe(700);
});
