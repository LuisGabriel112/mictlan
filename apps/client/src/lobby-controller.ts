import { PARTY_RULES, type ClassId } from '@mictlan/core';
import { connectToRaid, type RaidClient } from './connection';
import { formatElapsedTicks } from './encounter-clock';
import type { LaunchParams } from './launch-params';
import { connectionErrorText, lobbyPlayerText, lobbyRejectionText, missingRoles, screenForRoom, type ClientScreen } from './lobby';
import { isSyncedSnapshot, type RoomSnapshot } from './snapshot';

export interface LobbyRoom {
  readonly roomId: string;
  readonly sessionId: string;
  readonly state?: { toJSON(): unknown };
  send(type: string, payload?: unknown): void;
  onStateChange(callback: (state: { toJSON(): unknown }) => void): unknown;
  onMessage<Payload>(type: string, callback: (payload: Payload) => void): unknown;
}

export interface LobbyModel {
  screen: ClientScreen;
  code: string;
  selectedClass: ClassId;
  ready: boolean;
  players: string[];
  capacity: string;
  missing: string[];
  title: string;
  duration: string;
  busy: boolean;
  error: string;
}

export class LobbyController {
  private room?: LobbyRoom;
  private snapshot?: RoomSnapshot;
  private selectedClass: ClassId;
  private busy = false;
  private error = '';

  constructor(private readonly params: LaunchParams, private readonly client: RaidClient<LobbyRoom>,
    private readonly render: (model: LobbyModel) => void, private readonly connected: (room: LobbyRoom) => void) {
    this.selectedClass = params.classId;
  }

  async start(): Promise<void> {
    if (this.params.dev) await this.connect(this.params);
    else this.publish();
  }

  async createRoom(): Promise<void> {
    await this.connect({ ...this.params, dev: false, code: '' });
  }

  async joinRoom(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(normalized)) {
      this.error = 'Escribe un código de cuatro letras.';
      this.publish();
      return;
    }
    await this.connect({ ...this.params, dev: false, code: normalized });
  }

  chooseClass(classId: ClassId): void {
    if (!this.canPrepare()) return;
    this.selectedClass = classId;
    this.error = '';
    this.publish();
  }

  ready(): void {
    if (!this.canPrepare()) return;
    this.error = '';
    this.room?.send('ready', { classId: this.selectedClass });
    this.publish();
  }

  private async connect(params: LaunchParams): Promise<void> {
    if (this.busy || this.room) return;
    this.busy = true;
    this.error = '';
    this.publish();
    try {
      this.attach(await connectToRaid(params, this.client));
    } catch (error: unknown) {
      this.error = connectionErrorText(error);
    } finally {
      this.busy = false;
      this.publish();
    }
  }

  private attach(room: LobbyRoom): void {
    this.room = room;
    room.onStateChange((state) => this.receive(state.toJSON()));
    room.onMessage<unknown>('rejected', (payload) => this.reject(payload));
    this.connected(room);
    if (room.state) this.receive(room.state.toJSON());
  }

  private receive(snapshot: unknown): void {
    if (!isSyncedSnapshot(snapshot)) return;
    if (snapshot.status !== this.snapshot?.status) {
      this.error = '';
      if (snapshot.status === 'lobby') this.restoreClass(snapshot);
    }
    this.snapshot = snapshot;
    this.publish();
  }

  private restoreClass(snapshot: RoomSnapshot): void {
    this.selectedClass = snapshot.players[this.selfId]?.classId || this.selectedClass;
  }

  private reject(payload: unknown): void {
    this.error = lobbyRejectionText(payload);
    this.publish();
  }

  private get selfId(): string {
    return this.room?.sessionId ?? '';
  }

  private isReady(): boolean {
    return this.snapshot?.players[this.selfId]?.ready ?? false;
  }

  private canPrepare(): boolean {
    return this.snapshot?.status === 'lobby' && !this.isReady();
  }

  private presentation() {
    const players = Object.values(this.snapshot?.players ?? {});
    return { players: players.map((player) => lobbyPlayerText(player, this.selfId)), missing: missingRoles(players),
      capacity: `${players.length} / ${PARTY_RULES.maxPlayers} jugadores`,
      ...this.result() };
  }

  private result() {
    return { title: this.snapshot?.status === 'victory' ? '¡Victoria!' : 'Derrota',
      duration: formatElapsedTicks(this.snapshot?.elapsedTicks ?? 0) };
  }

  private publish(): void {
    this.render({ ...this.presentation(), screen: screenForRoom(this.snapshot?.status, this.room !== undefined, this.params.dev),
      code: this.room?.roomId ?? this.params.code, selectedClass: this.selectedClass, ready: this.isReady(),
      busy: this.busy, error: this.error });
  }
}
