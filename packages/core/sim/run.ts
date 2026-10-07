import { pathToFileURL } from 'node:url';
import { PARTY_RULES } from '../src/index.js';
import type { PlayerCount } from '../src/index.js';
import { buildReport, formatReport } from './report.js';
import { runEncounter } from './runner.js';

export interface SimulationArgs {
  players: PlayerCount;
  runs: number;
}

function readInteger(args: readonly string[], name: string): number {
  const prefix = `--${name}=`;
  const raw = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) throw new Error(`Falta el argumento --${name}.`);
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new Error(`--${name} debe ser un entero (recibido: "${raw}").`);
  return value;
}

function isPlayerCount(value: number): value is PlayerCount {
  return value >= PARTY_RULES.minPlayers && value <= PARTY_RULES.maxPlayers;
}

export function parseArgs(args: readonly string[]): SimulationArgs {
  const players = readInteger(args, 'players');
  if (!isPlayerCount(players)) {
    throw new Error(`--players debe estar entre ${PARTY_RULES.minPlayers} y ${PARTY_RULES.maxPlayers}.`);
  }
  const runs = readInteger(args, 'runs');
  if (runs < 1) throw new Error('--runs debe ser al menos 1.');
  return { players, runs };
}

function main(): void {
  let args: SimulationArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Uso: npm run sim -- --players=3 --runs=50');
    process.exitCode = 1;
    return;
  }
  const started = performance.now();
  // Seeds are 1..runs so any run can be reproduced individually.
  const results = Array.from({ length: args.runs }, (_, index) => runEncounter({ players: args.players, seed: index + 1 }));
  console.log(formatReport(buildReport(args.players, results)));
  console.log(`\nTiempo de simulación: ${((performance.now() - started) / 1000).toFixed(1)} s`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) main();
