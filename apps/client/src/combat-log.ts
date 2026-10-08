import { BOSS, type CombatEvent } from '@mictlan/core';
import { abilityName, combatEntityName } from './combat-names';
import { phaseLabel } from './encounter-clock';
import type { RoomSnapshot } from './snapshot';

export const COMBAT_LOG_LIMIT = 12;
type AmountEvent = Extract<CombatEvent, { type: 'damage' | 'healing' }>;
type NameOf = (entityId: string) => string;

function amountLine(event: AmountEvent, nameOf: NameOf): string[] {
  const amount = event.type === 'healing' ? event.effectiveAmount : event.amount;
  if (amount === 0) return [];
  const prefix = event.type === 'healing' ? '+' : '';
  return [`${nameOf(event.sourceId)} → ${nameOf(event.targetId)}: ${abilityName(event.abilityId)} ${prefix}${amount}`];
}

function announcementLine(event: CombatEvent, nameOf: NameOf): string[] {
  if (event.type === 'phaseChanged') return [phaseLabel(event.phase)];
  if (event.type === 'enraged') return ['¡Enfurecido!'];
  if (event.type === 'encounterEnded') return [event.outcome === 'victory' ? '¡Victoria!' : 'Derrota'];
  return castAnnouncement(event, nameOf);
}

function castAnnouncement(event: CombatEvent, nameOf: NameOf): string[] {
  if (event.type !== 'castStarted' || event.sourceId !== BOSS.id) return [];
  const target = event.targetId === null ? '' : ` → ${nameOf(event.targetId)}`;
  return [`${nameOf(event.sourceId)} prepara ${abilityName(event.abilityId)}${target}`];
}

function eventLines(event: CombatEvent, nameOf: NameOf): string[] {
  if (event.type === 'damage' || event.type === 'healing') return amountLine(event, nameOf);
  if (event.type !== 'death') return announcementLine(event, nameOf);
  return [`${nameOf(event.entityId)} murió (${deathCause(event, nameOf)})`];
}

function deathCause(event: Extract<CombatEvent, { type: 'death' }>, nameOf: NameOf): string {
  const ability = abilityName(event.abilityId);
  const omitOrigin = event.sourceId === 'environment' || event.sourceId === event.entityId;
  return omitOrigin ? ability : `${nameOf(event.sourceId)}: ${ability}`;
}

export function combatLogLines(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string): string[] {
  return events.flatMap((event) => eventLines(event, (id) => combatEntityName(id, snapshot, selfId)));
}

export function appendCombatLog(previous: readonly string[], incoming: readonly string[]): string[] {
  return [...previous, ...incoming].slice(-COMBAT_LOG_LIMIT);
}
