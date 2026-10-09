import { BOSS_ABILITIES, COMBAT_RULES } from '@mictlan/core';
import type { RoomSnapshot } from './snapshot';

export function unsafeRing(snapshot: RoomSnapshot): { innerRadiusMeters: number; outerRadiusMeters: number } | undefined {
  const wallRadius = COMBAT_RULES.arena.wallRadiusMeters;
  if (snapshot.phase !== 3 || snapshot.safeRadiusMeters >= wallRadius) return undefined;
  return { innerRadiusMeters: snapshot.safeRadiusMeters, outerRadiusMeters: wallRadius };
}

export function windWarningStyle(remainingTicks: number, nowMs: number) {
  const elapsedRatio = 1 - Math.min(1, remainingTicks / BOSS_ABILITIES.obsidianWind.effect.warningTicks);
  const pulse = (1 - Math.cos(nowMs * Math.PI / 200)) / 2;
  return { fillAlpha: 0.15 + 0.35 * elapsedRatio, borderAlpha: 0.6 + 0.4 * pulse, borderWidth: 3 + 2 * pulse };
}
