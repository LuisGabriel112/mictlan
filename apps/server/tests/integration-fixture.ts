import { matchMaker } from '@colyseus/core';
import { Client, type Room } from '@colyseus/sdk';
import { expect, vi } from 'vitest';
import { createRaidServer } from '../src/server.js';
import { RaidRoom } from '../src/rooms/RaidRoom.js';
import type { LobbyState } from '../src/schema/LobbyState.js';

type LobbyConnection = Room<unknown, LobbyState>;

export class IntegrationServer {
  readonly hosted;
  readonly clients: LobbyConnection[] = [];
  private endpoint = '';

  constructor(minimum?: string) {
    this.hosted = createRaidServer({ MICTLAN_DEV_MIN_PLAYERS: minimum }, () => 0);
  }

  async start(): Promise<void> {
    await this.hosted.gameServer.listen(0, '127.0.0.1');
    const address = this.hosted.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');
    this.endpoint = `ws://127.0.0.1:${address.port}`;
  }

  async create(options = {}): Promise<LobbyConnection> {
    const room = await new Client(this.endpoint).create<LobbyState>('raid', options);
    this.clients.push(room);
    await vi.waitFor(() => expect(room.state?.code).toBe(room.roomId));
    return room;
  }

  async join(code: string): Promise<LobbyConnection> {
    const room = await new Client(this.endpoint).joinById<LobbyState>(code);
    this.clients.push(room);
    await vi.waitFor(() => expect(room.state?.players.has(room.sessionId)).toBe(true));
    return room;
  }

  room(code: string): RaidRoom {
    const room = matchMaker.getLocalRoomById(code);
    if (!(room instanceof RaidRoom)) throw new Error('Expected raid room');
    return room;
  }

  async stop(): Promise<void> {
    await Promise.all(this.clients.map((client) => client.leave()));
    await this.hosted.gameServer.gracefullyShutdown(false);
  }
}
