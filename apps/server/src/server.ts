import { createServer } from 'node:http';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { createEncounter, step } from '@mictlan/core';
import { parseMinimumPlayers } from './lobby.js';
import { RoomCodePool } from './room-codes.js';
import { createRaidRoom } from './rooms/RaidRoom.js';

const DEFAULT_PORT = 2567;
const SEED_RANGE = 2 ** 32;

export interface RaidServerOptions {
  critChance?: number;
}

export function createRaidServer(
  environment: NodeJS.ProcessEnv = process.env, random: () => number = Math.random, options: RaidServerOptions = {},
) {
  const httpServer = createServer();
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false, gracefullyShutdown: false,
  });
  const room = createRaidRoom({
    minPlayers: parseMinimumPlayers(environment.MICTLAN_DEV_MIN_PLAYERS),
    codes: new RoomCodePool(random), createEncounter,
    nextSeed: () => Math.floor(random() * SEED_RANGE), step, critChance: options.critChance,
  });
  gameServer.define('raid', room);
  return { gameServer, httpServer };
}

export async function startRaidServer(environment: NodeJS.ProcessEnv = process.env) {
  const hosted = createRaidServer(environment);
  await hosted.gameServer.listen(Number(environment.PORT ?? DEFAULT_PORT));
  return hosted;
}
