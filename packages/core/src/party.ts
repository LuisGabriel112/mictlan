import { PARTY_RULES } from './data/classes.js';
import type { EncounterConfig, PlayerCount } from './types.js';

export function validatePartySize(config: EncounterConfig): void {
  const minimum = config.devMode ? PARTY_RULES.devMinPlayers : PARTY_RULES.minPlayers;
  if (config.players.length < minimum || config.players.length > PARTY_RULES.maxPlayers) {
    throw new Error(`El encuentro requiere entre ${minimum} y ${PARTY_RULES.maxPlayers} jugadores.`);
  }
}

export function scaledPlayerCount(count: number): PlayerCount {
  return Math.max(PARTY_RULES.minPlayers, count) as PlayerCount;
}
