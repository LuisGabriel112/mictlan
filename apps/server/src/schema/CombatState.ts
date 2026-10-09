import { schema, t, type SchemaType } from '@colyseus/schema';
import type { CastState, ClassId, Entity } from '@mictlan/core';

export const CombatCastState = schema({
  abilityId: t.string<CastState['abilityId']>(),
  targetId: t.string(),
  durationTicks: t.number(),
  remainingTicks: t.number(),
  interruptible: t.boolean(),
  // SPEC §11: telegraphed cone origin and unit direction; (0, 0) direction means no area.
  aimX: t.number().default(0),
  aimY: t.number().default(0),
  aimDx: t.number().default(0),
  aimDy: t.number().default(0),
}, 'CombatCastState');
export type CombatCastState = SchemaType<typeof CombatCastState>;

export const AuraState = schema({
  id: t.string(),
  sourceId: t.string(),
  remainingTicks: t.number(),
}, 'AuraState');
export type AuraState = SchemaType<typeof AuraState>;

export const CooldownState = schema({
  id: t.string(),
  remainingTicks: t.number(),
}, 'CooldownState');
export type CooldownState = SchemaType<typeof CooldownState>;

export const EntityState = schema({
  id: t.string(),
  type: t.string<Entity['type']>(),
  classId: t.string<ClassId | ''>(),
  x: t.number(),
  y: t.number(),
  health: t.number(),
  maxHealth: t.number(),
  mana: t.number(),
  maxMana: t.number(),
  targetId: t.string(),
  cast: t.ref(CombatCastState).optional(),
  auras: t.map(AuraState),
  gcdRemainingTicks: t.number().default(0),
  // Only running cooldowns are listed; an absent ability is ready.
  cooldowns: t.map(CooldownState),
}, 'EntityState');
export type EntityState = SchemaType<typeof EntityState>;

export const ZoneState = schema({
  id: t.string(),
  x: t.number(),
  y: t.number(),
  radiusMeters: t.number(),
  remainingTicks: t.number(),
}, 'ZoneState');
export type ZoneState = SchemaType<typeof ZoneState>;
