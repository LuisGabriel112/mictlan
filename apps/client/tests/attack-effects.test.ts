import { expect, test } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { ATTACK_EFFECT_MS, effectProgress, liveEffects, effectsFromEvents, type AttackEffect } from '../src/attack-effects';
import { ENTITY_COLORS } from '../src/palette';
import { entity, room } from './fixtures';

const snapshot = room([
  entity({ id: 'eagle', classId: 'eagle', x: 15, y: 0 }),
  entity({ id: 'healer', classId: 'healer', x: -10, y: 0 }),
  entity({ id: 'jaguar', classId: 'jaguar', x: 2.5, y: 0 }),
  entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0 }),
]);

function damage(sourceId: string, targetId: string, abilityId: string): CombatEvent {
  return { type: 'damage', tick: 1, sourceId, targetId, abilityId, amount: 10, critical: false } as CombatEvent;
}

function heal(sourceId: string, targetId: string, abilityId: string): CombatEvent {
  return { type: 'healing', tick: 1, sourceId, targetId, abilityId, amount: 10, effectiveAmount: 10, critical: false } as CombatEvent;
}

test('ranged damage launches a projectile in the attacker class color', () => {
  expect(effectsFromEvents([damage('eagle', 'boss', 'obsidianArrow')], snapshot, {}, 100)).toEqual([
    { kind: 'projectile', sourceId: 'eagle', targetId: 'boss', startMs: 100, durationMs: ATTACK_EFFECT_MS.projectile, color: ENTITY_COLORS.eagle },
  ]);
});

test('melee damage draws a slash from the attacker toward the target', () => {
  const effects = effectsFromEvents([damage('jaguar', 'boss', 'claw'), damage('boss', 'jaguar', 'autoAttack')], snapshot, {}, 0);
  expect(effects.map(({ kind, sourceId }) => [kind, sourceId])).toEqual([['slash', 'jaguar'], ['slash', 'boss']]);
  expect(effects[0].durationMs).toBe(ATTACK_EFFECT_MS.slash);
});

test('interpolated positions decide melee or ranged', () => {
  const effects = effectsFromEvents([damage('eagle', 'boss', 'quickShot')], snapshot, { eagle: { x: 1, y: 0 } }, 0);
  expect(effects[0].kind).toBe('slash');
});

test('ranged heals fly green and burst on the ally; self heals only burst', () => {
  const effects = effectsFromEvents([heal('healer', 'jaguar', 'remedy'), heal('healer', 'healer', 'remedy')], snapshot, {}, 0);
  expect(effects.map(({ kind, targetId, color }) => [kind, targetId, color])).toEqual([
    ['projectile', 'jaguar', 0x4cd964], ['burst', 'jaguar', 0x4cd964], ['burst', 'healer', 0x4cd964]]);
});

test('area and periodic sources never launch projectiles or slashes', () => {
  const events = [damage('boss', 'eagle', 'obsidianWind'), damage('environment', 'eagle', 'unsafeGround'), heal('healer', 'jaguar', 'copal')];
  expect(effectsFromEvents(events, snapshot, {}, 0)).toEqual([
    { kind: 'burst', sourceId: 'healer', targetId: 'jaguar', startMs: 0, durationMs: ATTACK_EFFECT_MS.burst, color: 0x4cd964 }]);
});

test('events with unknown units or of other types are ignored', () => {
  const castStarted: CombatEvent = { type: 'castStarted', tick: 1, sourceId: 'boss', abilityId: 'lamentOfTheDead', targetId: null, durationTicks: 60 };
  expect(effectsFromEvents([castStarted, damage('ghost', 'boss', 'claw'), damage('eagle', 'ghost', 'quickShot')], snapshot, {}, 0)).toEqual([]);
});

test('progress runs 0→1 and finished effects are dropped', () => {
  const effect: AttackEffect = { kind: 'slash', sourceId: 'a', targetId: 'b', startMs: 100, durationMs: 200, color: 0 };
  expect(effectProgress(effect, 100)).toBe(0);
  expect(effectProgress(effect, 200)).toBe(0.5);
  expect(effectProgress(effect, 400)).toBe(1);
  expect(liveEffects([effect], 299)).toEqual([effect]);
  expect(liveEffects([effect], 300)).toEqual([]);
});
