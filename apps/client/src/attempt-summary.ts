import { BOSS, type CombatEvent, type AbilityRejectionReason, type CastCancellationReason } from '@mictlan/core';
import { isSyncedSnapshot, type RoomSnapshot } from './snapshot';

export interface PlayerAttempt {
  damage: number;
  healing: number;
  cancelled: Partial<Record<CastCancellationReason, number>>;
  rejected: Partial<Record<AbilityRejectionReason, number>>;
  bossHits: ReadonlyMap<string, { hits: number; total: number }>;
  death?: { abilityId: string; sourceId: string };
}

type AttemptTotals = ReadonlyMap<string, PlayerAttempt>;
export interface AttemptSummary {
  snapshot?: RoomSnapshot;
  totals: AttemptTotals;
  pending: AttemptTotals;
}

export function emptyPlayerAttempt(): PlayerAttempt {
  return { damage: 0, healing: 0, cancelled: {}, rejected: {}, bossHits: new Map() };
}

export function createAttemptSummary(): AttemptSummary {
  return { totals: new Map(), pending: new Map() };
}

function updatePlayer(totals: AttemptTotals, id: string, update: (player: PlayerAttempt) => PlayerAttempt): AttemptTotals {
  const next = new Map(totals);
  next.set(id, update(totals.get(id) ?? emptyPlayerAttempt()));
  return next;
}

function addDamage(totals: AttemptTotals, event: Extract<CombatEvent, { type: 'damage' }>): AttemptTotals {
  const outgoing = updatePlayer(totals, event.sourceId, (player) => ({ ...player, damage: player.damage + event.amount }));
  if (event.sourceId !== BOSS.id) return outgoing;
  return updatePlayer(outgoing, event.targetId, (player) => {
    const previous = player.bossHits.get(event.abilityId) ?? { hits: 0, total: 0 };
    const bossHits = new Map(player.bossHits);
    bossHits.set(event.abilityId, { hits: previous.hits + 1, total: previous.total + event.amount });
    return { ...player, bossHits };
  });
}

function addLostAction(totals: AttemptTotals, event: Extract<CombatEvent, { type: 'castCancelled' | 'abilityRejected' }>): AttemptTotals {
  const field = event.type === 'castCancelled' ? 'cancelled' : 'rejected';
  return updatePlayer(totals, event.sourceId, (player) => {
    const counts: Partial<Record<string, number>> = player[field];
    return { ...player, [field]: { ...counts, [event.reason]: (counts[event.reason] ?? 0) + 1 } };
  });
}

function addEvent(totals: AttemptTotals, event: CombatEvent): AttemptTotals {
  switch (event.type) {
    case 'damage': return addDamage(totals, event);
    case 'healing': return updatePlayer(totals, event.sourceId, (player) => ({ ...player, healing: player.healing + event.effectiveAmount }));
    case 'castCancelled':
    case 'abilityRejected': return addLostAction(totals, event);
    case 'death': return updatePlayer(totals, event.entityId, (player) => ({ ...player,
      death: { abilityId: event.abilityId, sourceId: event.sourceId } }));
    default: return totals;
  }
}

export function accumulateAttemptEvents(summary: AttemptSummary, events: readonly CombatEvent[]): AttemptSummary {
  const waiting = !summary.snapshot || summary.snapshot.status === 'lobby';
  const field = waiting ? 'pending' : 'totals';
  return { ...summary, [field]: events.reduce(addEvent, summary[field]) };
}

function syncLobby(summary: AttemptSummary, snapshot: RoomSnapshot): AttemptSummary {
  const previous = summary.snapshot?.status;
  const waiting = previous === undefined || previous === 'lobby';
  return { ...createAttemptSummary(), snapshot, pending: waiting ? summary.pending : new Map() };
}

function startsAttempt(summary: AttemptSummary, snapshot: RoomSnapshot): boolean {
  const previous = summary.snapshot?.status;
  return previous === undefined || previous === 'lobby' || (snapshot.status === 'combat' && previous !== 'combat');
}

export function syncAttemptSnapshot(summary: AttemptSummary, snapshot: unknown): AttemptSummary {
  if (!isSyncedSnapshot(snapshot)) return summary;
  if (snapshot.status === 'lobby') return syncLobby(summary, snapshot);
  const starting = startsAttempt(summary, snapshot);
  const entities = starting ? snapshot.entities : { ...summary.snapshot?.entities, ...snapshot.entities };
  return { snapshot: { ...snapshot, entities }, totals: starting ? summary.pending : summary.totals, pending: new Map() };
}
