import * as Phaser from 'phaser';
import type { CombatEvent } from '@mictlan/core';
import { actionSlots } from '../action-bar';
import { groupFrameAt } from '../frames';
import { latestRejection, rejectionText } from '../hud-text';
import { PositionHistory, type Positions } from '../interpolation';
import { keyAction, type KeyAction } from '../keyboard';
import { MoveSender, NO_KEYS_HELD, applyMoveKey, moveVector, type HeldKeys } from '../move-input';
import type { RoomSnapshot } from '../snapshot';
import { allyAt, entityAtPoint, nextEnemyTarget } from '../targeting';
import { screenToWorld, PIXELS_PER_METER } from '../world-view';
import { drawArena, drawEntities, drawZones } from './arena-renderer';
import { Hud } from './hud';

export interface ArenaRoom {
  readonly sessionId: string;
  send(type: string, payload?: unknown): void;
  onStateChange(callback: (state: { toJSON(): unknown }) => void): unknown;
  onMessage(type: string, callback: (payload: CombatEvent[]) => void): unknown;
}

// SPEC §3: ~100 ms of interpolation delay hides the 20 Hz server tick.
const INTERPOLATION_DELAY_MS = 100;
const VIEW_MARGIN_METERS = 2;
const ARENA_DIAMETER_METERS = 2 * (20 + VIEW_MARGIN_METERS);

export class ArenaScene extends Phaser.Scene {
  private snapshot?: RoomSnapshot;
  private readonly history = new PositionHistory();
  private readonly moveSender = new MoveSender();
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private heldKeys: HeldKeys = NO_KEYS_HELD;

  constructor(private readonly room: ArenaRoom) {
    super('arena');
  }

  create(): void {
    this.world = this.add.graphics();
    this.hud = new Hud(this);
    const hudCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hudCamera.ignore(this.world);
    this.cameras.main.ignore(this.hud.objects);
    this.fitCamera(hudCamera);
    this.scale.on('resize', () => this.fitCamera(hudCamera));
    this.listen();
  }

  update(time: number): void {
    if (!this.snapshot) return;
    const positions: Positions = this.history.sample(performance.now() - INTERPOLATION_DELAY_MS);
    this.world.clear();
    drawArena(this.world, this.snapshot);
    drawZones(this.world, this.snapshot);
    drawEntities(this.world, this.snapshot, positions, this.room.sessionId);
    this.hud.update(this.snapshot, this.room.sessionId, time);
  }

  private listen(): void {
    this.room.onStateChange((state) => this.receiveState(state.toJSON() as RoomSnapshot));
    this.room.onMessage('events', (events) => this.receiveEvents(events));
    // Window events (not the render loop) drive input, so a hidden or paused tab still releases keys.
    const listeners = {
      keydown: (event: KeyboardEvent) => this.handleKey(event),
      keyup: (event: KeyboardEvent) => this.updateMove(applyMoveKey(this.heldKeys, event.code, false)),
      blur: () => this.updateMove(NO_KEYS_HELD),
    };
    window.addEventListener('keydown', listeners.keydown);
    window.addEventListener('keyup', listeners.keyup);
    window.addEventListener('blur', listeners.blur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', listeners.keydown);
      window.removeEventListener('keyup', listeners.keyup);
      window.removeEventListener('blur', listeners.blur);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleClick(pointer));
  }

  private receiveState(snapshot: RoomSnapshot): void {
    this.snapshot = snapshot;
    const positions: Positions = {};
    for (const entity of Object.values(snapshot.entities)) positions[entity.id] = { x: entity.x, y: entity.y };
    this.history.record(performance.now(), positions);
  }

  private receiveEvents(events: readonly CombatEvent[]): void {
    const reason = latestRejection(events, this.room.sessionId);
    if (reason) this.hud.showFlash(rejectionText(reason), this.time.now);
  }

  private updateMove(keys: HeldKeys): void {
    this.heldKeys = keys;
    const message = this.moveSender.update(moveVector(keys));
    if (message) this.room.send('move', message);
  }

  private handleKey(event: KeyboardEvent): void {
    const { action, preventDefault } = keyAction(event);
    if (preventDefault) event.preventDefault();
    this.updateMove(applyMoveKey(this.heldKeys, event.code, true));
    if (action && this.snapshot && !event.repeat) this.perform(action, this.snapshot);
  }

  private perform(action: KeyAction, snapshot: RoomSnapshot): void {
    const selfId = this.room.sessionId;
    if (action.type === 'cycleEnemy') {
      this.selectTarget(nextEnemyTarget(snapshot, selfId, snapshot.entities[selfId]?.targetId ?? ''));
    } else if (action.type === 'ally') {
      this.selectTarget(allyAt(snapshot, selfId, action.index));
    } else {
      const slot = actionSlots(snapshot, selfId)[action.slot - 1];
      if (slot) this.room.send('cast', { abilityId: slot.abilityId });
    }
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    if (!this.snapshot) return;
    // Group frames live in screen space and take priority over the world under them.
    const framed = groupFrameAt(this.snapshot, this.room.sessionId, { x: pointer.x, y: pointer.y });
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.selectTarget(framed ?? entityAtPoint(this.snapshot, screenToWorld(point)));
  }

  private selectTarget(entityId: string | undefined): void {
    if (entityId !== undefined) this.room.send('target', { entityId });
  }

  private fitCamera(hudCamera: Phaser.Cameras.Scene2D.Camera): void {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    hudCamera.setSize(width, height);
    this.cameras.main.setZoom(Math.min(width, height) / (ARENA_DIAMETER_METERS * PIXELS_PER_METER));
    this.cameras.main.centerOn(0, 0);
  }
}
