import { expectTypeOf, test } from 'vitest';
import type {
  Ability,
  AbilityId,
  Aura,
  ClassId,
  CombatEvent,
  EncounterConfig,
  EncounterState,
  Entity,
  Input,
} from '../src/index.js';

test('Ability supports exactly the four SPEC target types', () => {
  expectTypeOf<Ability['targetType']>().toEqualTypeOf<'self' | 'ally' | 'enemy' | 'none'>();
});

test('EncounterConfig contains player ids/classes and optional critChance/devMode', () => {
  expectTypeOf<EncounterConfig>().toEqualTypeOf<{
    players: readonly { readonly id: string; readonly classId: ClassId }[];
    critChance?: number;
    devMode?: boolean;
  }>();
});

test('damage and healing events require sourceId and abilityId', () => {
  type DamageEvent = Extract<CombatEvent, { type: 'damage' }>;
  type HealingEvent = Extract<CombatEvent, { type: 'healing' }>;
  expectTypeOf<DamageEvent>().toExtend<{ sourceId: string; abilityId: AbilityId }>();
  expectTypeOf<HealingEvent>().toExtend<{ sourceId: string; abilityId: AbilityId }>();
  expectTypeOf<Omit<DamageEvent, 'sourceId'>>().not.toExtend<DamageEvent>();
  expectTypeOf<Omit<DamageEvent, 'abilityId'>>().not.toExtend<DamageEvent>();
  expectTypeOf<Omit<HealingEvent, 'sourceId'>>().not.toExtend<HealingEvent>();
  expectTypeOf<Omit<HealingEvent, 'abilityId'>>().not.toExtend<HealingEvent>();
});

test('Entity, Aura, EncounterState and Input expose the combat state contracts', () => {
  expectTypeOf<Entity['type']>().toEqualTypeOf<'player' | 'boss' | 'xolo'>();
  expectTypeOf<Entity['auras']>().toEqualTypeOf<Aura[]>();
  expectTypeOf<Aura>().toExtend<{ sourceId: string; abilityId: AbilityId; remainingTicks: number }>();
  expectTypeOf<EncounterState['entities']>().toEqualTypeOf<Record<string, Entity>>();
  expectTypeOf<EncounterState['status']>().toEqualTypeOf<'lobby' | 'combat' | 'victory' | 'defeat'>();
  expectTypeOf<Input['type']>().toEqualTypeOf<'move' | 'target' | 'cast'>();
  expectTypeOf<Input>().toExtend<{ playerId: string }>();
});
