import * as Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { parseLaunchParams } from './launch-params';
import { LobbyController } from './lobby-controller';
import { LobbyView } from './lobby-view';
import { ArenaScene, type ArenaRoom } from './scene/ArenaScene';
import './lobby.css';

function createArena(room: ArenaRoom): void {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14101c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(room)],
  });
}

function start(): void {
  const params = parseLaunchParams(window.location.search, window.location.hostname);
  const view = new LobbyView(document, params.code);
  const controller = new LobbyController(params, new Client(params.serverUrl), (model) => view.render(model), createArena);
  view.bind(controller);
  void controller.start();
}

start();
