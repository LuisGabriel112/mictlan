import { Client } from '@colyseus/sdk';
import { parseLaunchParams } from './launch-params';
import { LobbyController } from './lobby-controller';
import { LobbyView } from './lobby-view';
import { HelpView } from './help-view';
import { ArenaScene, type ArenaRoom } from './scene/ArenaScene';
import { createBrowserWorld, createModelLibrary, createSceneryLibrary } from './world-3d/browser-world';
import { TutorialController, browserTutorialStore } from './tutorial-controller';
import { TutorialView } from './tutorial-view';
import './lobby.css';
import './help.css';
import './hud.css';

const models = createModelLibrary(import.meta.env.BASE_URL);
const scenery = createSceneryLibrary(import.meta.env.BASE_URL);

function createArena(room: ArenaRoom): void {
  const host = document.getElementById('game')!;
  // T5.2: no Phaser; the arena owns its DOM HUD and recreates the Three.js world each attempt.
  const arena = new ArenaScene(room, () => createBrowserWorld(host, window.devicePixelRatio, models, scenery),
    { document, window, host, now: () => window.performance.now() });
  arena.create();
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
