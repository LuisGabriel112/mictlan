import * as Phaser from 'phaser';
import type { CombatEvent } from '@mictlan/core';
import { actionSlots } from '../action-bar';
import { DestinationMarker } from '../click-move';
import { combatLogLines } from '../combat-log';
import { ageFloatingTexts, emptyFloatingTexts, enqueueFloatingTexts } from '../floating-text';
import { groupFrameAt } from '../frames';
import { latestRejection, rejectionText } from '../hud-text';
import { PositionHistory, type Positions } from '../interpolation';
import { keyAction, type KeyAction } from '../keyboard';
import type { RoomSnapshot } from '../snapshot';
import { allyAt, entityAtPoint, nextEnemyTarget } from '../targeting';
import { screenToWorld, PIXELS_PER_METER } from '../world-view';
import { drawArena, drawDestination, drawEntities, drawZones } from './arena-renderer';
import { Hud } from './hud';
import { FloatingTextView } from './floating-text-view';

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
  private readonly destination = new DestinationMarker();
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private floatingTexts = emptyFloatingTexts();
  private floatingView!: FloatingTextView;
  private pendingCombatEvents: CombatEvent[] = [];

  constructor(private readonly room: ArenaRoom) {
    super('arena');
  }

  create(): void {
    this.world = this.add.graphics();
    this.hud = new Hud(this);
    const hudCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    hudCamera.ignore(this.world);
    this.floatingView = new FloatingTextView(this, hudCamera);
    this.cameras.main.ignore(this.hud.objects);
    this.fitCamera(hudCamera);
    this.scale.on('resize', () => this.fitCamera(hudCamera));
    this.listen();
  }

  update(time: number, delta: number): void {
    if (!this.snapshot) return;
    const positions: Positions = this.history.sample(performance.now() - INTERPOLATION_DELAY_MS);
    this.world.clear();
    drawArena(this.world, this.snapshot);
    drawZones(this.world, this.snapshot, time);
    const marker = this.destination.position;
    if (marker && this.destination.visibleAt(this.snapshot.entities[this.room.sessionId])) drawDestination(this.world, marker);
    drawEntities(this.world, this.snapshot, positions, this.room.sessionId);
    this.hud.update(this.snapshot, this.room.sessionId, time);
    this.floatingTexts = ageFloatingTexts(this.floatingTexts, delta);
    this.floatingView.draw(this.floatingTexts, this.hud.floatingTextOcclusions);
  }

  private listen(): void {
    this.room.onStateChange((state) => this.receiveState(state.toJSON() as RoomSnapshot));
    this.room.onMessage('events', (events) => this.receiveEvents(events));
    const onKeyDown = (event: KeyboardEvent) => this.handleKey(event);
    window.addEventListener('keydown', onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKeyDown));
    // Right click moves (T3.7), so the browser menu must not open over the arena.
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleClick(pointer));
  }

  private receiveState(snapshot: RoomSnapshot): void {
    if (snapshot.status === 'lobby' || (snapshot.status === 'combat' && this.snapshot?.status !== 'combat')) {
      this.hud.clearLog();
      this.floatingTexts = { ...this.floatingTexts, texts: [] };
    }
    this.snapshot = snapshot;
    const positions: Positions = {};
    for (const entity of Object.values(snapshot.entities)) positions[entity.id] = { x: entity.x, y: entity.y };
    this.history.record(performance.now(), positions);
    if (snapshot.status !== 'lobby' && this.pendingCombatEvents.length > 0) {
      this.showCombatEvents(this.pendingCombatEvents, snapshot);
      this.pendingCombatEvents = [];
    }
  }

  private receiveEvents(events: readonly CombatEvent[]): void {
    const reason = latestRejection(events, this.room.sessionId);
    if (reason) this.hud.showFlash(rejectionText(reason), this.time.now);
    // Messages may arrive before the first combat schema patch.
    if (!this.snapshot || this.snapshot.status === 'lobby') {
      this.pendingCombatEvents.push(...events);
      return;
    }
    this.showCombatEvents(events, this.snapshot);
  }

  private showCombatEvents(events: readonly CombatEvent[], snapshot: RoomSnapshot): void {
    this.hud.appendLog(combatLogLines(events, snapshot, this.room.sessionId));
    this.floatingTexts = enqueueFloatingTexts(this.floatingTexts, events,
      { ...snapshot.entities, ...this.history.sample(performance.now() - INTERPOLATION_DELAY_MS) });
  }

  private handleKey(event: KeyboardEvent): void {
    const { action, preventDefault } = keyAction(event);
    if (preventDefault) event.preventDefault();
    if (action && this.snapshot && !event.repeat) this.perform(action, this.snapshot);
  }

  private perform(action: KeyAction, snapshot: RoomSnapshot): void {
    const selfId = this.room.sessionId;
    if (action.type === 'cycleEnemy') {
      this.selectTarget(nextEnemyTarget(snapshot, selfId, snapshot.entities[selfId]?.targetId ?? ''));
    } else if (action.type === 'ally') {
      this.selectTarget(allyAt(snapshot, selfId, action.index));
    } else if (action.type === 'stop') {
      this.stopWalking();
    } else {
      this.cast(snapshot, action.slot);
    }
  }

  private cast(snapshot: RoomSnapshot, slotNumber: number): void {
    const slot = actionSlots(snapshot, this.room.sessionId)[slotNumber - 1];
    if (!slot) return;
    // The server stops the walk for cast-time abilities, so the marker goes too.
    if (slot.hasCastTime) this.destination.clear();
    this.room.send('cast', { abilityId: slot.abilityId });
  }

  private stopWalking(): void {
    this.destination.clear();
    this.room.send('stop', {});
  }

  private handleClick(pointer: Phaser.Input.Pointer): void {
    if (!this.snapshot) return;
    if (pointer.rightButtonDown()) return this.walkTo(pointer);
    // Group frames live in screen space and take priority over the world under them.
    const framed = groupFrameAt(this.snapshot, this.room.sessionId, { x: pointer.x, y: pointer.y });
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.selectTarget(framed ?? entityAtPoint(this.snapshot, screenToWorld(point)));
  }

  private walkTo(pointer: Phaser.Input.Pointer): void {
    const destination = screenToWorld(this.cameras.main.getWorldPoint(pointer.x, pointer.y));
    this.destination.set(destination);
    this.room.send('moveTo', destination);
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
