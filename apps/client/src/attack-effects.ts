import { COMBAT_RULES, type CombatEvent } from '@mictlan/core';
import type { Positions } from './interpolation';
import { entityColor } from './palette';
import { centerDistance, entityRadius, type EntitySnapshot, type RoomSnapshot } from './snapshot';

export type AttackEffectKind = 'projectile' | 'slash' | 'burst';

export interface AttackEffect {
  kind: AttackEffectKind;
  sourceId: string;
  targetId: string;
  startMs: number;
  durationMs: number;
  color: number;
}

export const ATTACK_EFFECT_MS = { projectile: 250, slash: 200, burst: 400 } as const;
const HEAL_COLOR = 0x4cd964;
// Zones and periodic ticks already read on the ground or in numbers; a flying shot would lie about their source.
const NO_DELIVERY_ABILITIES: ReadonlySet<string> = new Set(['obsidianWind', 'unsafeGround', 'copal']);

type AmountEvent = Extract<CombatEvent, { type: 'damage' | 'healing' }>;

function effect(kind: AttackEffectKind, event: AmountEvent, startMs: number, color: number): AttackEffect {
  return { kind, sourceId: event.sourceId, targetId: event.targetId, startMs, durationMs: ATTACK_EFFECT_MS[kind], color };
}

function isMelee(source: EntitySnapshot, target: EntitySnapshot, positions: Positions): boolean {
  const reach = COMBAT_RULES.meleeRangeMeters + entityRadius(source) + entityRadius(target);
  return centerDistance(positions[source.id] ?? source, positions[target.id] ?? target) <= reach;
}

function delivery(event: AmountEvent, snapshot: RoomSnapshot, positions: Positions, nowMs: number): AttackEffect[] {
  const source = snapshot.entities[event.sourceId];
  const target = snapshot.entities[event.targetId];
  if (!source || !target || source === target || NO_DELIVERY_ABILITIES.has(event.abilityId)) return [];
  const color = event.type === 'healing' ? HEAL_COLOR : entityColor(source);
  return [effect(isMelee(source, target, positions) ? 'slash' : 'projectile', event, nowMs, color)];
}

function eventEffects(event: CombatEvent, snapshot: RoomSnapshot, positions: Positions, nowMs: number): AttackEffect[] {
  if (event.type !== 'damage' && event.type !== 'healing') return [];
  if (!snapshot.entities[event.targetId]) return [];
  const shots = delivery(event, snapshot, positions, nowMs);
  return event.type === 'healing' ? [...shots, effect('burst', event, nowMs, HEAL_COLOR)] : shots;
}

export function effectsFromEvents(events: readonly CombatEvent[], snapshot: RoomSnapshot, positions: Positions, nowMs: number): AttackEffect[] {
  return events.flatMap((event) => eventEffects(event, snapshot, positions, nowMs));
}

export function effectProgress(effect: AttackEffect, nowMs: number): number {
  return Math.min(1, Math.max(0, (nowMs - effect.startMs) / effect.durationMs));
}

export function liveEffects(effects: readonly AttackEffect[], nowMs: number): AttackEffect[] {
  return effects.filter((item) => nowMs < item.startMs + item.durationMs);
}
