import { expect, test } from 'vitest';
import { advanceEntityAuras, applyAura, clearDeadAuras, damageTakenModifiers } from '../src/auras.js';
import { CLASSES } from '../src/data/classes.js';
import { combatEncounter, freezeCombat } from './combat-fixtures.js';

const copal = CLASSES.healer.abilities[2].effect.aura;
const shield = CLASSES.jaguar.abilities[2].effect.aura;

test('applyAura initializes Copal from its definition without mutating the target', () => {
  const target = combatEncounter().entities.p1;
  freezeCombat(target);
  const applied = applyAura(target, copal, 'p2', 'copal');
  expect(applied).toEqual({ ...target, auras: [{
    definition: copal, sourceId: 'p2', abilityId: 'copal', remainingTicks: 200, ticksUntilNextEffect: 20,
  }] });
  expect(applied.auras[0].definition).toBe(copal);
  expect(target.auras).toEqual([]);
});

test('applyAura replaces matching definitions and attribution while preserving unrelated auras', () => {
  const protectedTarget = applyAura(combatEncounter().entities.p1, shield, 'p1', 'obsidianShield');
  const initial = applyAura(protectedTarget, copal, 'p2', 'copal');
  const advanced = advanceEntityAuras(initial).entity;
  freezeCombat(advanced);
  const refreshed = applyAura(advanced, copal, 'other-healer', 'copal');
  expect(refreshed.auras).toHaveLength(2);
  expect(refreshed.auras[0]).toBe(advanced.auras[0]);
  expect(refreshed.auras[1]).toEqual({
    definition: copal, sourceId: 'other-healer', abilityId: 'copal', remainingTicks: 200, ticksUntilNextEffect: 20,
  });
  expect(advanced.auras[1]).toMatchObject({ remainingTicks: 199, ticksUntilNextEffect: 19 });
});

test.each([0, -1])('applyAura leaves a dead target at %s health unchanged', (health) => {
  const target = { ...combatEncounter().entities.p1, health };
  expect(applyAura(target, copal, 'p2', 'copal')).toBe(target);
});

test('advanceEntityAuras advances both clocks and preserves the frozen input', () => {
  const target = applyAura(combatEncounter().entities.p1, copal, 'p2', 'copal');
  freezeCombat(target);
  const result = advanceEntityAuras(target);
  expect(result.healingAuras).toEqual([]);
  expect(result.entity).toEqual({ ...target, auras: [{
    ...target.auras[0], remainingTicks: 199, ticksUntilNextEffect: 19,
  }] });
  expect(target.auras[0]).toMatchObject({ remainingTicks: 200, ticksUntilNextEffect: 20 });
});

test('advanceAuraClock resets the interval from the definition after a due pulse', () => {
  const definition = { ...copal, durationTicks: 8, firstTickDelayTicks: 1, intervalTicks: 3 };
  const target = applyAura(combatEncounter().entities.p1, definition, 'p2', 'copal');
  const result = advanceEntityAuras(target);
  expect(result.healingAuras).toEqual([target.auras[0]]);
  expect(result.entity.auras[0]).toMatchObject({ remainingTicks: 7, ticksUntilNextEffect: 3 });
  expect(advanceEntityAuras(result.entity).healingAuras).toEqual([]);
});

test('isHealingTick includes the final pulse before expiration but excludes expired auras', () => {
  const target = applyAura(combatEncounter().entities.p1, { ...copal, durationTicks: 1, firstTickDelayTicks: 1 }, 'p2', 'copal');
  const final = advanceEntityAuras(target);
  expect(final.entity.auras).toEqual([]);
  expect(final.healingAuras).toEqual(target.auras);
  const expired = { ...target, auras: [{ ...target.auras[0], remainingTicks: 0 }] };
  expect(advanceEntityAuras(expired)).toEqual({ entity: { ...expired, auras: [] }, healingAuras: [] });
});

test('shield clocks retain a null periodic timer and emit no healing', () => {
  const target = applyAura(combatEncounter().entities.p1, shield, 'p1', 'obsidianShield');
  expect(target.auras[0]).toMatchObject({ remainingTicks: 120, ticksUntilNextEffect: null });
  const advanced = advanceEntityAuras(target);
  expect(advanced.entity.auras[0]).toMatchObject({ remainingTicks: 119, ticksUntilNextEffect: null });
  expect(advanced.healingAuras).toEqual([]);
});

test('clearDeadAuras clears only dead units carrying auras and otherwise retains references', () => {
  const empty = combatEncounter().entities.p1;
  const living = applyAura(empty, copal, 'p2', 'copal');
  const dead = { ...living, health: 0 };
  freezeCombat(dead);
  expect(clearDeadAuras(dead)).toEqual({ ...dead, auras: [] });
  expect(clearDeadAuras(empty)).toBe(empty);
  expect(clearDeadAuras(living)).toBe(living);
  const cleared = clearDeadAuras(dead);
  expect(clearDeadAuras(cleared)).toBe(cleared);
});

test('advanceEntityAuras cannot heal a dead unit and preserves units without auras', () => {
  const empty = combatEncounter().entities.p1;
  const target = applyAura(empty, { ...copal, firstTickDelayTicks: 1 }, 'p2', 'copal');
  const dead = { ...target, health: -1 };
  expect(advanceEntityAuras(dead)).toEqual({ entity: { ...dead, auras: [] }, healingAuras: [] });
  expect(advanceEntityAuras(empty).entity).toBe(empty);
  const deadEmpty = { ...empty, health: 0 };
  expect(advanceEntityAuras(deadEmpty).entity).toBe(deadEmpty);
});

test('damageTakenModifiers returns every active multiplier and excludes periodic and expired auras', () => {
  const protectedTarget = applyAura(combatEncounter().entities.p1, shield, 'p1', 'obsidianShield');
  const target = applyAura(protectedTarget, copal, 'p2', 'copal');
  target.auras.push({ ...protectedTarget.auras[0], definition: { ...shield, multiplierBps: 8000 } });
  target.auras.push({ ...protectedTarget.auras[0], remainingTicks: 0 });
  freezeCombat(target);
  expect(damageTakenModifiers(target)).toEqual([5000, 8000]);
  expect(damageTakenModifiers({ ...target, health: 0 })).toEqual([]);
  expect(damageTakenModifiers(combatEncounter().entities.p1)).toEqual([]);
});
