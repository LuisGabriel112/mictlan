import * as Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { parseLaunchParams } from './launch-params';
import { LobbyController } from './lobby-controller';
import { LobbyView } from './lobby-view';
import { HelpView } from './help-view';
import { ArenaScene, type ArenaRoom } from './scene/ArenaScene';
import { TutorialController, browserTutorialStore } from './tutorial-controller';
import { TutorialView } from './tutorial-view';
import './lobby.css';
import './help.css';

function createArena(room: ArenaRoom): void {
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14101c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(room)],
  });
  new TutorialController(room, browserTutorialStore(() => window.localStorage), new TutorialView(document), window);
}

function start(): void {
  const params = parseLaunchParams(window.location.search, window.location, import.meta.env.PROD);
  const view = new LobbyView(document, params.code);
  const help = new HelpView(document, window);
  const controller = new LobbyController(params, new Client(params.serverUrl), (model) => {
    view.render(model);
    help.render(model.screen, model.selectedClass);
  }, createArena);
  view.bind(controller);
  void controller.start();
}

start();
