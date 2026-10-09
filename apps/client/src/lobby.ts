import { PARTY_RULES, type ClassId, type EncounterStatus } from '@mictlan/core';
import { formatElapsedTicks } from './encounter-clock';
import type { RoomSnapshot } from './snapshot';

export const LOBBY_CLASSES = ['jaguar', 'healer', 'eagle'] as const;
export type ClientScreen = 'start' | 'lobby' | 'arena' | 'result';
type LobbyPlayer = RoomSnapshot['players'][string];

export function screenForRoom(hasRoom: boolean, status?: EncounterStatus, dev = false): ClientScreen {
  if (!hasRoom) return 'start';
  if (status === 'victory' || status === 'defeat') return 'result';
  return status === 'combat' || dev ? 'arena' : 'lobby';
}

// Only ready players reserve roles on the server. Retained classes after a wipe do not.
export function missingRoles(players: readonly LobbyPlayer[]): ClassId[] {
  return LOBBY_CLASSES.filter((classId) =>
    players.filter((player) => player.ready && player.classId === classId).length < PARTY_RULES.composition[classId].min);
}

const MISSING_ROLE_TEXT: Record<ClassId, string> = {
  jaguar: 'Falta Jaguar', healer: 'Falta Tícitl', eagle: 'Falta al menos un Águila',
};

export function missingRolesText(players: readonly LobbyPlayer[]): string {
  const missing = missingRoles(players);
  return missing.length ? missing.map((role) => MISSING_ROLE_TEXT[role]).join(' · ') : 'Composición completa';
}

export function lobbyRejectionText(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'reason' in payload) {
    if (payload.reason === 'composition') return 'Ese rol ya está ocupado';
    if (payload.reason === 'invalid_class') return 'Clase inválida';
  }
  return 'No se pudo confirmar tu clase';
}

export function connectionErrorText(joining: boolean): string {
  return joining
    ? 'No se pudo entrar: el código no existe, la sala está llena o ya empezó. Revisa el código y la conexión.'
    : 'No se pudo conectar al servidor. Revisa la conexión e inténtalo de nuevo.';
}

export function resultText(snapshot: Pick<RoomSnapshot, 'status' | 'elapsedTicks'>): { title: string; duration: string } {
  return {
    title: snapshot.status === 'victory' ? '¡Victoria!' : 'Derrota',
    duration: `Duración del encuentro: ${formatElapsedTicks(snapshot.elapsedTicks)}`,
  };
}

// Local selection is a draft. Only a server snapshot may mark the player ready.
export class LobbySelection {
  classId: ClassId = 'eagle';
  ready = false;
  error = '';
  private previousStatus?: EncounterStatus;

  choose(classId: ClassId): void {
    if (this.ready) return;
    this.classId = classId;
    this.error = '';
  }

  receive(snapshot: RoomSnapshot, selfId: string): void {
    const self = snapshot.players[selfId];
    this.ready = snapshot.status === 'lobby' && (self?.ready ?? false);
    if (self?.classId && (this.ready || this.previousStatus !== 'lobby')) this.classId = self.classId;
    if (snapshot.status !== this.previousStatus || this.ready) this.error = '';
    this.previousStatus = snapshot.status;
  }

  reject(payload: unknown): void {
    this.error = lobbyRejectionText(payload);
  }
}
