import { Room, type Client } from '@colyseus/core';
import { BOSS, PARTY_RULES, type createEncounter, type EncounterConfig, type EncounterState } from '@mictlan/core';
import { COMBAT_LOOP_RULES } from '../combat-clock.js';
import { CombatSession, type CoreRemovePlayer, type CoreStep } from '../combat-session.js';
import { canStartEncounter, encounterConfig, validateReady } from '../lobby.js';
import type { RoomCodePool } from '../room-codes.js';
import { LobbyPlayerState, LobbyState } from '../schema/LobbyState.js';
import { resetLobby, syncEncounter } from '../schema/sync.js';

export interface RaidDependencies {
  minPlayers: number;
  codes: Pick<RoomCodePool, 'reserve' | 'release'>;
  createEncounter: typeof createEncounter;
  nextSeed: () => number;
  step: CoreStep;
  removePlayer: CoreRemovePlayer;
  // Only tests override encounter balance; clients cannot supply these options.
  critChance?: number;
  initialBossHealth?: number;
}

const COMBAT_MESSAGES = ['move', 'target', 'cast'] as const;

type LobbyClient = Pick<Client, 'sessionId' | 'send'>;

export class RaidRoom extends Room<{ state: LobbyState }> {
  state = new LobbyState();
  maxClients = PARTY_RULES.maxPlayers;
  private session?: CombatSession;

  get encounter(): EncounterState | undefined {
    return this.session?.state;
  }

  constructor(private readonly dependencies: RaidDependencies) {
    super();
  }

  onCreate(): void {
    this.roomId = this.dependencies.codes.reserve();
    this.state.code = this.roomId;
    this.onMessage<unknown>('ready', (client, payload) => this.receiveReady(client, payload));
    for (const type of COMBAT_MESSAGES) {
      this.onMessage<unknown>(type, (client, payload) => this.session?.receive(client.sessionId, type, payload));
    }
  }

  onJoin(client: Pick<Client, 'sessionId'>): void {
    if (this.state.status !== 'lobby') throw new Error('La sala ya inició el combate.');
    this.state.players.set(client.sessionId, new LobbyPlayerState({ id: client.sessionId }));
  }

  onLeave(client: Pick<Client, 'sessionId'>): void {
    this.state.players.delete(client.sessionId);
    if (!this.session) return;
    const events = this.session.disconnect(client.sessionId);
    if (events.length === 0) return;
    syncEncounter(this.state, this.session.state);
    this.broadcast('events', events);
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
    const encounter = this.initialEncounter(players);
    this.session = new CombatSession(encounter, this.dependencies.step, this.dependencies.removePlayer);
    syncEncounter(this.state, encounter);
    this.setTimestep((deltaMs) => this.advanceCombat(deltaMs), COMBAT_LOOP_RULES.tickMs);
    await this.lock();
  }

  private initialEncounter(players: Parameters<typeof encounterConfig>[0]): EncounterState {
    const encounter = this.dependencies.createEncounter(this.combatConfig(players), this.dependencies.nextSeed());
    const { initialBossHealth } = this.dependencies;
    if (initialBossHealth === undefined) return encounter;
    const boss = { ...encounter.entities[BOSS.id], health: initialBossHealth };
    return { ...encounter, entities: { ...encounter.entities, [BOSS.id]: boss } };
  }

  private combatConfig(players: Parameters<typeof encounterConfig>[0]): EncounterConfig {
    const config = encounterConfig(players, this.dependencies.minPlayers);
    const { critChance } = this.dependencies;
    return critChance === undefined ? config : { ...config, critChance };
  }

  private advanceCombat(deltaMs: number): void {
    if (!this.session || this.session.finished) return;
    const previousTick = this.session.state.tick;
    const events = this.session.advance(deltaMs);
    if (this.session.state.tick !== previousTick) syncEncounter(this.state, this.session.state);
    if (events.length > 0) this.broadcast('events', events);
    if (!this.session.finished) return;
    // Colyseus 0.18.18 retains the stopped interval handle, blocking clock ticks from patches.
    this.setTimestep(() => undefined, COMBAT_LOOP_RULES.tickMs);
    this.clock.setTimeout(() => this.returnToLobby(), BOSS.returnToLobbyDelayTicks * COMBAT_LOOP_RULES.tickMs);
  }

  private async returnToLobby(): Promise<void> {
    this.session = undefined;
    resetLobby(this.state);
    await this.unlock();
  }
}

export function createRaidRoom(dependencies: RaidDependencies) {
  return class extends RaidRoom {
    constructor() {
      super(dependencies);
    }
  };
}
