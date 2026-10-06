import type { CastState, EncounterState, Input, PlayerAbilityId, PlayerEntity } from '../src/index.js';
import { combatCast, combatPlayer, combatTick } from './combat-fixtures.js';
export { combatEncounter as scenario, freezeCombat as freezeDeep } from './combat-fixtures.js';

export function player(state: EncounterState, id = 'p2'): PlayerEntity {
  return combatPlayer(state, id);
}

export function cast(abilityId: PlayerAbilityId = 'remedy', playerId = 'p2'): Input {
  return combatCast(abilityId, playerId);
}

export function target(entityId: string | null = 'p1', playerId = 'p2'): Input {
  return { type: 'target', playerId, entityId };
}

export function move(dx = 1, dy = 0, playerId = 'p2'): Input {
  return { type: 'move', playerId, dx, dy };
}

export function tick(state: EncounterState, inputs: readonly Input[] = []): ReturnType<typeof combatTick> {
  const result = combatTick(state, inputs);
  // T1.3 asserts the ability lifecycle; T1.4 tests assert the interleaved combat effects.
  return { ...result, events: result.events.filter(({ type }) => !['damage', 'healing', 'death'].includes(type)) };
}

export function advance(state: EncounterState, ticks: number): EncounterState {
  for (let index = 0; index < ticks; index += 1) state = tick(state).state;
  return state;
}

export function activeCast(remainingTicks = 10): CastState {
  return { abilityId: 'remedy', targetId: 'p1', durationTicks: 30, remainingTicks, interruptible: true };
}

