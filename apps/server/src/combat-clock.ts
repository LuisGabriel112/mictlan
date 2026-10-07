import { COMBAT_RULES } from '@mictlan/core';

export const COMBAT_LOOP_RULES = {
  tickMs: COMBAT_RULES.tickDurationMs,
  // After a stall, catching up more than this would freeze the room; the backlog is dropped instead.
  maxStepsPerAdvance: 5,
} as const;

export interface TickBudget {
  steps: number;
  accumulatedMs: number;
}

export function consumeTicks(accumulatedMs: number, deltaMs: number): TickBudget {
  const addedMs = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
  const totalMs = accumulatedMs + addedMs;
  const dueSteps = Math.floor(totalMs / COMBAT_LOOP_RULES.tickMs);
  if (dueSteps >= COMBAT_LOOP_RULES.maxStepsPerAdvance) {
    return { steps: COMBAT_LOOP_RULES.maxStepsPerAdvance, accumulatedMs: 0 };
  }
  return { steps: dueSteps, accumulatedMs: totalMs - dueSteps * COMBAT_LOOP_RULES.tickMs };
}
