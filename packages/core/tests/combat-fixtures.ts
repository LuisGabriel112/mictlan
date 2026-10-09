import { BOSS, COMBAT_RULES, createEncounter, step } from '../src/index.js';
import type { EncounterState, Input, PlayerAbilityId, PlayerEntity } from '../src/index.js';

export function combatEncounter(critChance = 0): EncounterState {
  return createEncounter({ players: [
    { id: 'p1', classId: 'jaguar' }, { id: 'p2', classId: 'healer' }, { id: 'p3', classId: 'eagle' },
  ], critChance }, 42);
}

export function combatPlayer(state: EncounterState, id = 'p3'): PlayerEntity {
  const player = state.entities[id];
  if (player.type !== 'player') throw new Error(`Missing player: ${id}`);
  return player;
}

export function combatTick(state: EncounterState, inputs: readonly Input[] = []): ReturnType<typeof step> {
  return step(state, inputs, COMBAT_RULES.tickDurationMs);
}

export function combatCast(abilityId: PlayerAbilityId, playerId = 'p3'): Input {
  return { type: 'cast', playerId, abilityId };
}

export function readyCast(state: EncounterState, abilityId: PlayerAbilityId, playerId: string, targetId: string): void {
  combatPlayer(state, playerId).cast = {
    abilityId, targetId, durationTicks: 40, remainingTicks: 1, interruptible: true,
  };
}

export function arrowEncounter(critChance = 0): EncounterState {
  const state = combatEncounter(critChance);
  readyCast(state, 'obsidianArrow', 'p3', BOSS.id);
  return state;
}

export function freezeCombat(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  Object.values(value).forEach(freezeCombat);
  Object.freeze(value);
}

// Ability-focused tests predate the SPEC §11 ranged auto-attacks; muting one keeps the event list about the rule under test.
export function muteAutoAttack(state: EncounterState, playerId: string): void {
  state.entities[playerId].autoAttackRemainingTicks = 1_000_000;
}
