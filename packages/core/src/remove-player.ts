import { replaceCombatEntity, type CombatResult } from './combat-effects.js';
import type { EncounterState } from './types.js';

export function removePlayer(state: EncounterState, playerId: string): CombatResult {
  const player = state.entities[playerId];
  if (!player || player.type !== 'player' || player.health <= 0) return { state, events: [] };
  const removed = { ...player, health: 0, cast: null };
  return {
    state: replaceCombatEntity(state, removed),
    events: [{ type: 'death', entityId: playerId, sourceId: playerId, abilityId: 'disconnect', tick: state.tick }],
  };
}
