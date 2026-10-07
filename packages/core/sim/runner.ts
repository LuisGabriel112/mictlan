import { BOSS, COMBAT_RULES, SIMULATION_RULES, createEncounter, step } from '../src/index.js';
import type { CombatEvent, EncounterState, PlayerCount } from '../src/index.js';
import { createBotParty, getBotInputs } from './bots.js';

export interface RunEncounterOptions {
  players: PlayerCount;
  seed: number;
  critChance?: number;
}

export interface RunEncounterResult {
  state: EncounterState;
  events: CombatEvent[];
  ticks: number;
  // Ticks where the boss switched from one player target to another (initial acquisition excluded).
  bossTargetChanges: number;
}

function bossTargetId(state: EncounterState): string | null {
  return state.entities[BOSS.id]?.targetId ?? null;
}

export function runEncounter({ players, seed, critChance }: RunEncounterOptions): RunEncounterResult {
  let state = createEncounter({ players: createBotParty(players), critChance }, seed);
  const events: CombatEvent[] = [];
  let bossTargetChanges = 0;
  for (let ticks = 1; ticks <= SIMULATION_RULES.maxTicks; ticks += 1) {
    const previousTarget = bossTargetId(state);
    const result = step(state, getBotInputs(state), COMBAT_RULES.tickDurationMs);
    state = result.state;
    events.push(...result.events);
    const target = bossTargetId(state);
    if (previousTarget !== null && target !== null && target !== previousTarget) bossTargetChanges += 1;
    if (state.status === 'victory' || state.status === 'defeat') return { state, events, ticks, bossTargetChanges };
  }
  throw new Error(`El encuentro superó el límite de seguridad de ${SIMULATION_RULES.maxTicks} ticks.`);
}
