import { BOSS, CLASSES, XOLO, type CombatEvent } from '@mictlan/core';
import type { ActionSlot, SlotState } from './action-bar';
import type { EntitySnapshot, RoomSnapshot } from './snapshot';

const REJECTION_TEXT: Readonly<Record<string, string>> = {
  gcd: 'Aún no está lista', cooldown: 'En recarga', insufficient_mana: 'Sin maná',
  invalid_target: 'Objetivo inválido', out_of_range: 'Fuera de alcance',
  moving: 'No puedes castear en movimiento', casting: 'Ya estás casteando', dead: 'Estás muerto',
  not_casting: 'El objetivo no está casteando',
};

const STATUS_TEXT = { combat: '', victory: '¡Victoria!', defeat: 'Derrota' } as const;

const SLOT_LABELS: Readonly<Record<Exclude<SlotState, 'cooldown'>, { caption: string; tint: number }>> = {
  ready: { caption: '', tint: 0xffffff }, gcd: { caption: '', tint: 0x888888 }, casting: { caption: '', tint: 0x888888 },
  no_mana: { caption: 'Sin maná', tint: 0x5577ff }, out_of_range: { caption: 'Lejos', tint: 0xff5555 },
  no_target: { caption: 'Sin objetivo', tint: 0x888888 }, dead: { caption: '', tint: 0x444444 },
};

export function rejectionText(reason: string): string {
  return Object.hasOwn(REJECTION_TEXT, reason) ? REJECTION_TEXT[reason] : 'No se puede usar';
}

export function statusText(snapshot: RoomSnapshot): string {
  if (snapshot.status === 'lobby') return `Esperando jugadores · Código ${snapshot.code}`;
  return STATUS_TEXT[snapshot.status];
}

export function slotLabel({ state, cooldownSeconds }: Pick<ActionSlot, 'state' | 'cooldownSeconds'>) {
  if (state === 'cooldown') return { caption: cooldownSeconds.toFixed(1), tint: 0x666666 };
  return SLOT_LABELS[state];
}

export function entityName(entity: EntitySnapshot, selfId: string): string {
  if (entity.type === 'boss') return BOSS.name;
  if (entity.type === 'xolo') return XOLO.name;
  const name = entity.classId === '' ? '' : CLASSES[entity.classId].name;
  return entity.id === selfId ? `${name} (tú)` : name;
}

export function latestRejection(events: readonly CombatEvent[], selfId: string): string | undefined {
  const rejections = events.filter((event) => event.type === 'abilityRejected' && event.sourceId === selfId);
  const latest = rejections.at(-1);
  return latest?.type === 'abilityRejected' ? latest.reason : undefined;
}
