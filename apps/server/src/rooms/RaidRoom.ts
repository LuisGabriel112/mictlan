import { Room, type Client } from '@colyseus/core';
import { PARTY_RULES, type createEncounter, type EncounterState } from '@mictlan/core';
import { canStartEncounter, encounterConfig, validateReady } from '../lobby.js';
import type { RoomCodePool } from '../room-codes.js';
import { LobbyPlayerState, LobbyState } from '../schema/LobbyState.js';

export interface RaidDependencies {
  minPlayers: number;
  codes: Pick<RoomCodePool, 'reserve' | 'release'>;
  createEncounter: typeof createEncounter;
  nextSeed: () => number;
}

type LobbyClient = Pick<Client, 'sessionId' | 'send'>;

export class RaidRoom extends Room<{ state: LobbyState }> {
  state = new LobbyState();
  maxClients = PARTY_RULES.maxPlayers;
  encounter?: EncounterState;

  constructor(private readonly dependencies: RaidDependencies) {
    super();
  }

  onCreate(): void {
    this.roomId = this.dependencies.codes.reserve();
    this.state.code = this.roomId;
    this.onMessage<unknown>('ready', (client, payload) => this.receiveReady(client, payload));
  }

  onJoin(client: Pick<Client, 'sessionId'>): void {
    if (this.state.status !== 'lobby') throw new Error('La sala ya inició el combate.');
    this.state.players.set(client.sessionId, new LobbyPlayerState({ id: client.sessionId }));
  }

  async onLeave(client: Pick<Client, 'sessionId'>): Promise<void> {
    if (this.state.status !== 'lobby') return;
    this.state.players.delete(client.sessionId);
    await this.tryStartEncounter();
  }

  onDispose(): void {
    this.dependencies.codes.release(this.roomId);
  }

  async receiveReady(client: LobbyClient, payload: unknown): Promise<void> {
    if (this.state.status !== 'lobby') return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const result = validateReady([...this.state.players.values()], client.sessionId, payload);
    if ('reason' in result) {
      client.send('rejected', result);
      return;
    }
    player.classId = result.classId;
    player.ready = true;
    await this.tryStartEncounter();
  }

  private async tryStartEncounter(): Promise<void> {
    const players = [...this.state.players.values()];
    if (!canStartEncounter(players, this.dependencies.minPlayers)) return;
    const config = encounterConfig(players, this.dependencies.minPlayers);
    this.encounter = this.dependencies.createEncounter(config, this.dependencies.nextSeed());
    this.state.status = 'combat';
    await this.lock();
  }
}

export function createRaidRoom(dependencies: RaidDependencies) {
  return class extends RaidRoom {
    constructor() {
      super(dependencies);
    }
  };
}
