import { BOSS_ABILITIES, COMBAT_RULES } from '@mictlan/core';

export function unsafeRing(safeRadiusMeters: number): { radius: number; width: number } {
  const wall = COMBAT_RULES.arena.wallRadiusMeters;
  const safe = Math.min(wall, Math.max(0, safeRadiusMeters));
  return { radius: (wall + safe) / 2, width: wall - safe };
}

export function windWarningStyle(remainingTicks: number, timeMs: number) {
  const progress = 1 - Math.min(1, Math.max(0, remainingTicks / BOSS_ABILITIES.obsidianWind.effect.warningTicks));
  const pulse = (1 + Math.sin(timeMs * Math.PI / 250)) / 2;
  return { fillAlpha: 0.15 + 0.35 * progress, borderAlpha: 0.55 + 0.45 * pulse, borderWidth: 2 + 3 * pulse };
}
