import { vi } from 'vitest';
import { LobbyController, type LobbyRoom, type LobbyModel } from '../src/lobby-controller';
import { parseLaunchParams } from '../src/launch-params';
import { room } from './fixtures';
import type { RoomSnapshot } from '../src/snapshot';

export function lobbyConnection(initial?: RoomSnapshot) {
  const states: ((state: { toJSON(): unknown }) => void)[] = [];
  const messages = new Map<string, (payload: unknown) => void>();
  const connection: LobbyRoom = {
    roomId: 'ABCD', sessionId: 'self', send: vi.fn(),
    state: initial ? { toJSON: () => initial } : undefined,
    onStateChange: (callback) => { states.push(callback); },
    onMessage: <Payload>(type: string, callback: (payload: Payload) => void) => {
      messages.set(type, callback as (payload: unknown) => void);
    },
  };
  return { connection, states, messages };
}

export function lobbyFixture(search = '', initial?: RoomSnapshot) {
  const transport = lobbyConnection(initial);
  const client = { create: vi.fn(async () => transport.connection), joinById: vi.fn(async () => transport.connection),
    joinOrCreate: vi.fn(async () => transport.connection) };
  const render = vi.fn<(model: LobbyModel) => void>();
  const connected = vi.fn();
  const controller = new LobbyController(parseLaunchParams(search), client, render, connected);
  const latest = () => render.mock.calls.at(-1)![0];
  const receive = (snapshot: RoomSnapshot) => transport.states.forEach((callback) => callback({ toJSON: () => snapshot }));
  return { ...transport, client, render, connected, controller, latest, receive };
}

export function lobbySnapshot(ready = false, status: RoomSnapshot['status'] = 'lobby') {
  return room([], { status, elapsedTicks: 1480, players: {
    self: { id: 'self', classId: 'jaguar', ready },
    healer: { id: 'healer', classId: 'healer', ready },
    eagle: { id: 'eagle', classId: 'eagle', ready },
  } });
}
