import { CLASSES, PARTY_RULES, type ClassId, type EncounterStatus } from '@mictlan/core';
import type { RoomSnapshot } from './snapshot';

export type LobbyPlayer = RoomSnapshot['players'][string];
export type ClientScreen = 'start' | 'lobby' | 'combat' | 'result';

const MISSING_ROLE_TEXT: Record<ClassId, string> = {
  jaguar: 'Falta Jaguar', healer: 'Falta Tícitl', eagle: 'Falta al menos un Águila',
};

export function missingRoles(players: readonly LobbyPlayer[]): string[] {
  const classes = Object.keys(PARTY_RULES.composition) as ClassId[];
  return classes.filter((classId) => {
    const count = players.filter((player) => player.ready && player.classId === classId).length;
    return count < PARTY_RULES.composition[classId].min;
  }).map((classId) => MISSING_ROLE_TEXT[classId]);
}

export function screenForRoom(status: EncounterStatus | undefined, hasRoom: boolean, dev: boolean): ClientScreen {
  if (!hasRoom) return 'start';
  if (status === 'victory' || status === 'defeat') return 'result';
  return dev || status === 'combat' ? 'combat' : 'lobby';
}

export function lobbyRejectionText(payload: unknown): string {
  const reason = payload && typeof payload === 'object' && 'reason' in payload ? payload.reason : undefined;
  if (reason === 'composition') return 'Ese rol ya está ocupado';
  if (reason === 'invalid_class') return 'Clase inválida';
  return 'No se pudo marcar listo. Inténtalo de nuevo.';
}

export function connectionErrorText(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 522) {
    return 'No se pudo conectar al servidor. Inténtalo de nuevo.';
  }
  return roomAccessErrorText(error);
}

function roomAccessErrorText(error: object): string {
  const locked = 'message' in error && typeof error.message === 'string' && error.message.includes('locked');
  return locked ? 'La sala está llena o ya inició el combate.' : 'La sala no existe. Revisa el código.';
}

export function lobbyPlayerText(player: LobbyPlayer, selfId: string): string {
  const name = player.id === selfId ? 'Tú' : player.id;
  const className = player.classId ? CLASSES[player.classId].name : 'Sin clase';
  return `${name} · ${className} · ${player.ready ? 'Listo' : 'Sin preparar'}`;
}
