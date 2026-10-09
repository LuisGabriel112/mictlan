import type { CombatEvent } from '@mictlan/core';
import { HIT_FLASH_COLORS } from './palette';

interface HitFlash {
  readonly startedAtMs: number;
  readonly critical: boolean;
}

export type HitFlashes = ReadonlyMap<string, HitFlash>;

export interface HitFlashFrame {
  readonly hits: HitFlashes;
  readonly nowMs: number;
}

export interface HitFlashPose {
  readonly intensity: number;
  readonly scale: number;
  readonly color: number;
}

const HIT_FLASH_STYLE = {
  normal: { durationMs: 200, scaleIncrease: 0.06 },
  critical: { durationMs: 280, scaleIncrease: 0.1 },
} as const;

export function recordHitFlashes(hits: HitFlashes, events: readonly CombatEvent[], nowMs: number): HitFlashes {
  const updated = new Map(hits);
  for (const event of events) {
    if (event.type !== 'damage') continue;
    updated.set(event.targetId, { startedAtMs: nowMs, critical: event.critical });
  }
  return updated;
}

export function hitFlashFor(hits: HitFlashes, entityId: string, nowMs: number): HitFlashPose {
  const hit = hits.get(entityId);
  if (!hit) return { intensity: 0, scale: 1, color: HIT_FLASH_COLORS.normal };
  const kind = hit.critical ? 'critical' : 'normal';
  const style = HIT_FLASH_STYLE[kind];
  const intensity = Math.max(0, Math.min(1, 1 - (nowMs - hit.startedAtMs) / style.durationMs));
  return { intensity, scale: 1 + style.scaleIncrease * intensity, color: HIT_FLASH_COLORS[kind] };
}
