import type { CombatResult } from '../combat-effects.js';
import type { EncounterState, Entity } from '../types.js';

export function hasInterruptibleCast(target: Entity | undefined): boolean {
  return target?.cast?.interruptible === true;
}

export function interruptCast(state: EncounterState, targetId: string | null): CombatResult {
  const target = targetId === null ? undefined : state.entities[targetId];
  if (!target || !hasInterruptibleCast(target) || target.cast === null) return { state, events: [] };
  return {
    state: { ...state, entities: { ...state.entities, [target.id]: { ...target, cast: null } } },
    events: [{ type: 'castCancelled', tick: state.tick, sourceId: target.id,
      abilityId: target.cast.abilityId, reason: 'interrupted' }],
  };
}
