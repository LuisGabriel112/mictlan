import { applyDamage } from '../combat.js';
import { replaceCombatEntity } from '../combat-effects.js';
import type { CombatResult } from '../combat-effects.js';
import { BOSS } from '../data/boss.js';
import { COMBAT_RULES } from '../data/classes.js';
import type { CombatEvent, EncounterState } from '../types.js';

function safeRadius(state: EncounterState): number {
  const arena = COMBAT_RULES.arena;
  if (state.phase !== 3) return arena.wallRadiusMeters;
  const final = BOSS.finalPhaseArena;
  const progress = Math.min(state.phaseElapsedTicks, final.shrinkDurationTicks) / final.shrinkDurationTicks;
  return arena.initialSafeRadiusMeters - (arena.initialSafeRadiusMeters - final.safeRadiusMeters) * progress;
}

export function advanceArena(state: EncounterState): CombatResult {
  const safeRadiusMeters = safeRadius(state);
  if (safeRadiusMeters !== state.safeRadiusMeters) state = { ...state, safeRadiusMeters };
  const events: CombatEvent[] = [];
  const { center } = COMBAT_RULES.arena;
  for (const id of Object.keys(state.entities).sort()) {
    const player = state.entities[id];
    if (player.type !== 'player' || player.health <= 0) continue;
    if (Math.hypot(player.x - center.x, player.y - center.y) <= safeRadiusMeters) continue;
    // Apply the fixed amount directly: no mitigation, RNG, enrage or threat.
    const hit = applyDamage(player, {
      sourceId: 'environment', abilityId: 'unsafeGround', tick: state.tick,
      amount: BOSS.finalPhaseArena.damagePerTick, critical: false,
    });
    state = replaceCombatEntity(state, hit.entity);
    events.push(...hit.events);
  }
  return { state, events };
}

export function endEncounter(state: EncounterState): CombatResult {
  if (state.status === 'victory' || state.status === 'defeat') return { state, events: [] };
  const boss = state.entities[BOSS.id];
  const outcome = boss && boss.health <= 0 ? 'victory'
    : Object.values(state.entities).some((entity) => entity.type === 'player' && entity.health > 0) ? null : 'defeat';
  if (outcome === null) return { state, events: [] };
  return { state: { ...state, status: outcome }, events: [{ type: 'encounterEnded', outcome, tick: state.tick }] };
}
