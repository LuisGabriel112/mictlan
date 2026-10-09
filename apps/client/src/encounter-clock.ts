import { BOSS_PHASES, COMBAT_RULES } from '@mictlan/core';
import type { RoomSnapshot } from './snapshot';

export function formatElapsedTicks(elapsedTicks: number): string {
  const seconds = Math.floor(Math.max(0, elapsedTicks) / COMBAT_RULES.ticksPerSecond);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function encounterClockText(snapshot: RoomSnapshot): string {
  if (snapshot.status === 'lobby') return '';
  const phase = snapshot.phase;
  const phaseName = phase === 1 || phase === 2 || phase === 3 ? BOSS_PHASES[phase].name : '';
  return `${formatElapsedTicks(snapshot.elapsedTicks)} · Fase ${phase}: ${phaseName}`;
}
