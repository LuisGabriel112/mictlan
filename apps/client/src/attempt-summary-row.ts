import { COMBAT_RULES, type CastCancellationReason } from '@mictlan/core';
import { emptyPlayerAttempt, type AttemptSummary, type PlayerAttempt } from './attempt-summary';
import { abilityName, combatEntityName } from './combat-names';
import { entityName, rejectionText } from './hud-text';
import type { EntitySnapshot, RoomSnapshot } from './snapshot';

// Referencia de bots perfectos de 3 jugadores del simulador: npm run sim.
const BOT_REFERENCE = { players: 3, jaguarDps: 25, eagleDps: 58, healerHps: 27 } as const;
export const BOT_REFERENCE_TEXT = `Referencia de bots perfectos (${BOT_REFERENCE.players} jugadores): `
  + `Jaguar ${BOT_REFERENCE.jaguarDps} DPS · Águila ${BOT_REFERENCE.eagleDps} DPS · Tícitl ${BOT_REFERENCE.healerHps} HPS`;

const CANCELLATION_LABELS: Record<CastCancellationReason, string> = {
  moving: 'Movimiento', flight: 'Vuelo', interrupted: 'Interrupción',
  invalid_target: 'Objetivo inválido', out_of_range: 'Fuera de alcance',
};

export interface AttemptSummaryRow {
  self: boolean;
  cells: string[];
}

function formatCounts<Reason extends string>(counts: Partial<Record<Reason, number>>, label: (reason: Reason) => string): string {
  const reasons = Object.keys(counts) as Reason[];
  const total = reasons.reduce((sum, reason) => sum + counts[reason]!, 0);
  return [String(total), ...reasons.map((reason) => `${label(reason)}: ${counts[reason]}`)].join(' · ');
}

function formatBossHits(bossHits: PlayerAttempt['bossHits']): string {
  const hits = [...bossHits].map(([abilityId, { hits, total }]) =>
    `${abilityName(abilityId)}: ${hits} ${hits === 1 ? 'golpe' : 'golpes'} / ${total} daño`);
  return hits.join(' · ') || '—';
}

function formatDeath(death: PlayerAttempt['death'], snapshot: RoomSnapshot, selfId: string): string {
  if (!death) return '—';
  const author = death.sourceId === 'environment' ? 'Entorno' : combatEntityName(death.sourceId, snapshot, selfId);
  return `${abilityName(death.abilityId)} — ${author}`;
}

function formatRate(total: number, seconds: number): string {
  const rate = seconds > 0 ? total / seconds : 0;
  return rate.toFixed(1).replace('.', ',');
}

function formatRow(player: EntitySnapshot, totals: PlayerAttempt, snapshot: RoomSnapshot, selfId: string): AttemptSummaryRow {
  const seconds = snapshot.elapsedTicks / COMBAT_RULES.ticksPerSecond;
  return { self: player.id === selfId, cells: [entityName(player, selfId),
    String(totals.damage), formatRate(totals.damage, seconds), String(totals.healing), formatRate(totals.healing, seconds),
    formatCounts(totals.cancelled, (reason) => CANCELLATION_LABELS[reason]), formatCounts(totals.rejected, rejectionText),
    formatBossHits(totals.bossHits), formatDeath(totals.death, snapshot, selfId)] };
}

export function attemptSummaryRows(summary: AttemptSummary, selfId: string): AttemptSummaryRow[] {
  const snapshot = summary.snapshot;
  if (!snapshot || snapshot.status === 'lobby') return [];
  return Object.values(snapshot.entities).filter((entity) => entity.type === 'player')
    .map((player) => formatRow(player, summary.totals.get(player.id) ?? emptyPlayerAttempt(), snapshot, selfId));
}
