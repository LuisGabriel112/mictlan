import * as Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { connectToRaid, type RaidClient } from './connection';
import { parseLaunchParams } from './launch-params';
import { ArenaScene, type ArenaRoom } from './scene/ArenaScene';

async function start(): Promise<void> {
  const params = parseLaunchParams(window.location.search, window.location.hostname);
  const client = new Client(params.serverUrl) as unknown as RaidClient<ArenaRoom>;
  const room = await connectToRaid(params, client);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14101c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(room)],
  });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  document.body.textContent = `No se pudo conectar al servidor: ${message}`;
});
