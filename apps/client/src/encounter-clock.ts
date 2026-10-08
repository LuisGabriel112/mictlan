import { BOSS_PHASES, COMBAT_RULES } from '@mictlan/core';
import type { RoomSnapshot } from './snapshot';

export function formatElapsedTicks(elapsedTicks: number): string {
  const seconds = Math.floor(elapsedTicks / COMBAT_RULES.ticksPerSecond);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

export function phaseLabel(phase: number): string {
  const definition = Object.entries(BOSS_PHASES).find(([id]) => Number(id) === phase)?.[1];
  return definition ? `Fase ${phase}: ${definition.name}` : '';
}

export function encounterHeader(snapshot: RoomSnapshot): string {
  return snapshot.status === 'lobby' ? '' : `${formatElapsedTicks(snapshot.elapsedTicks)} · ${phaseLabel(snapshot.phase)}`;
}
