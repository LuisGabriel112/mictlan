import { COMBAT_RULES, SIMULATION_RULES, createEncounter, step } from '../src/index.js';
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
}

export function runEncounter({ players, seed, critChance }: RunEncounterOptions): RunEncounterResult {
  let state = createEncounter({ players: createBotParty(players), critChance }, seed);
  const events: CombatEvent[] = [];
  for (let ticks = 1; ticks <= SIMULATION_RULES.maxTicks; ticks += 1) {
    const result = step(state, getBotInputs(state), COMBAT_RULES.tickDurationMs);
    state = result.state;
    events.push(...result.events);
    if (state.status === 'victory' || state.status === 'defeat') return { state, events, ticks };
  }
  throw new Error(`El encuentro superó el límite de seguridad de ${SIMULATION_RULES.maxTicks} ticks.`);
}
