import { PARTY_RULES, type ClassId, type EncounterConfig } from '@mictlan/core';

export interface LobbyPlayer {
  id: string;
  classId: ClassId | '';
  ready: boolean;
}

export type ReadyRejection = 'invalid_class' | 'composition';
type ReadyResult = { classId: ClassId } | { reason: ReadyRejection };

export function parseMinimumPlayers(setting: string | undefined): number {
  if (!setting || !/^\d+$/.test(setting)) return PARTY_RULES.minPlayers;
  const minimum = Number(setting);
  return minimum >= PARTY_RULES.devMinPlayers && minimum <= PARTY_RULES.minPlayers
    ? minimum : PARTY_RULES.minPlayers;
}

export function parseReadyClass(payload: unknown): ClassId | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  if (!('classId' in payload)) return undefined;
  return isClassId(payload.classId) ? payload.classId : undefined;
}

export function isClassId(classId: unknown): classId is ClassId {
  return typeof classId === 'string' && Object.hasOwn(PARTY_RULES.composition, classId);
}

function readyClassCount(players: readonly LobbyPlayer[], classId: ClassId, excludedId?: string): number {
  return players.filter((player) => player.id !== excludedId && player.ready && player.classId === classId).length;
}

export function validateReady(players: readonly LobbyPlayer[], playerId: string, payload: unknown): ReadyResult {
  const classId = parseReadyClass(payload);
  if (!classId) return { reason: 'invalid_class' };
  if (readyClassCount(players, classId, playerId) >= PARTY_RULES.composition[classId].max) {
    return { reason: 'composition' };
  }
  return { classId };
}

export function canStartEncounter(players: readonly LobbyPlayer[], minPlayers: number): boolean {
  if (players.length < minPlayers || players.length > PARTY_RULES.maxPlayers) return false;
  if (players.some((player) => !player.ready || player.classId === '')) return false;
  const classes = Object.keys(PARTY_RULES.composition) as ClassId[];
  return classes.every((classId) => {
    const count = readyClassCount(players, classId);
    const minimum = minPlayers < PARTY_RULES.minPlayers ? 0 : PARTY_RULES.composition[classId].min;
    return count >= minimum && count <= PARTY_RULES.composition[classId].max;
  });
}

export function encounterConfig(players: readonly LobbyPlayer[], minPlayers: number): EncounterConfig {
  return {
    players: players.flatMap(({ id, classId }) => classId === '' ? [] : [{ id, classId }]),
    devMode: minPlayers < PARTY_RULES.minPlayers,
  };
}
