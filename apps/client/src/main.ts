import * as Phaser from 'phaser';
import { Client } from '@colyseus/sdk';
import { connectToRaid } from './connection';
import { parseLaunchParams } from './launch-params';
import { connectionErrorText, LobbySelection, screenForRoom } from './lobby';
import { LobbyView } from './lobby-view';
import { ArenaScene } from './scene/ArenaScene';
import { readRoomSnapshot, type RoomSnapshot } from './snapshot';
import './lobby.css';

const params = parseLaunchParams(window.location.search, window.location.hostname);
const client = new Client(params.serverUrl);
type RaidState = { toJSON(): unknown };
const connection = {
  create: (name: string) => client.create<RaidState>(name),
  joinById: (code: string) => client.joinById<RaidState>(code),
  joinOrCreate: (name: string) => client.joinOrCreate<RaidState>(name),
};
type RaidRoom = Awaited<ReturnType<typeof connection.create>>;
let room: RaidRoom | undefined;
let snapshot: RoomSnapshot | undefined;
let game: Phaser.Game | undefined;
let connecting = false;
let selection = new LobbySelection();
const view = new LobbyView(params.code, {
  create: () => { void connect(''); },
  join: (code) => { void connect(code); },
  choose: (classId) => { selection.choose(classId); render(); },
  ready: () => {
    if (room && snapshot?.status === 'lobby' && !selection.ready) {
      selection.error = '';
      room.send('ready', { classId: selection.classId });
      render();
    }
  },
});

function render(): void {
  const screen = screenForRoom(room !== undefined, snapshot?.status, params.dev);
  view.show(screen, selection.error);
  // Keep Phaser mounted so it receives state/events, but show only the active screen.
  const canvas = document.getElementById('game');
  if (canvas) canvas.style.visibility = screen === 'arena' ? 'visible' : 'hidden';
  if (snapshot && room) view.update(snapshot, room.sessionId, selection);
}

function attachRoom(joined: RaidRoom): void {
  room = joined;
  selection = new LobbySelection();
  joined.onStateChange((state) => {
    snapshot = readRoomSnapshot(state.toJSON());
    if (!snapshot) return;
    selection.receive(snapshot, joined.sessionId);
    render();
  });
  joined.onMessage('rejected', (payload: unknown) => { selection.reject(payload); render(); });
  joined.onLeave(() => {
    room = undefined;
    snapshot = undefined;
    game?.destroy(true);
    game = undefined;
    selection.error = 'Se perdió la conexión con la sala. Puedes volver a crear una o unirte.';
    render();
  });
  if (joined.state) {
    snapshot = readRoomSnapshot(joined.state.toJSON());
    if (snapshot) selection.receive(snapshot, joined.sessionId);
  }
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#14101c',
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    scene: [new ArenaScene(joined)],
  });
  render();
}

async function connect(code: string): Promise<void> {
  if (connecting || room) return;
  connecting = true;
  view.setConnecting(true);
  try {
    attachRoom(await connectToRaid({ ...params, code }, connection));
  } catch {
    selection.error = connectionErrorText(code !== '' && !params.dev);
  } finally {
    connecting = false;
    view.setConnecting(false);
    render();
  }
}

render();
if (params.dev) void connect('');
