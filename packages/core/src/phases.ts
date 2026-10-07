import type { CombatResult } from './combat-effects.js';
import { BOSS, BOSS_PHASES } from './data/boss.js';
import { COMBAT_RULES } from './data/classes.js';
import type { AbilityId, EncounterState, EnemyEntity, Phase } from './types.js';

function activeBoss(state: EncounterState): EnemyEntity | undefined {
  const boss = state.entities[BOSS.id];
  return state.bossActive && boss?.type === 'boss' && boss.health > 0 ? boss : undefined;
}

export function createPhaseAbilityTimers(phase: Phase): EncounterState['bossAbilityTimers'] {
  return Object.fromEntries(
    Object.entries(BOSS_PHASES[phase].timers).map(([id, timer]) => [id, timer.firstTicks]),
  );
}

export function updateBossPhase(state: EncounterState): CombatResult {
  const boss = activeBoss(state);
  if (!boss) return { state, events: [] };
  let phase = state.phase;
  for (const candidate of Object.keys(BOSS_PHASES).map(Number) as Phase[]) {
    const threshold = BOSS_PHASES[candidate].healthThresholdBps;
    if (candidate > phase && boss.health * COMBAT_RULES.basisPointsScale <= boss.maxHealth * threshold) phase = candidate;
  }
  if (phase === state.phase) return { state, events: [] };
  // Evaluated after actions: the next tick is the first tick of the new phase.
  return {
    state: { ...state, phase, phaseElapsedTicks: 0,
      bossAbilityTimers: createPhaseAbilityTimers(phase), bossAbilityQueue: [] },
    events: [{ type: 'phaseChanged', phase, tick: state.tick }],
  };
}

export function advanceBossEnrage(state: EncounterState): CombatResult {
  const boss = activeBoss(state);
  if (!boss || state.enraged || state.elapsedTicks < BOSS.enrage.afterTicks) return { state, events: [] };
  return {
    state: { ...state, enraged: true },
    events: [{ type: 'enraged', sourceId: boss.id, tick: state.tick }],
  };
}

export function enrageDamageModifiers(state: EncounterState, sourceId: string, abilityId: AbilityId): number[] {
  const affected = BOSS.enrage.affectedAbilityIds.some((id) => id === abilityId);
  return state.enraged && state.entities[sourceId]?.type === 'boss' && affected
    ? [BOSS.enrage.damageMultiplierBps] : [];
}
