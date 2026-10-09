import * as Phaser from 'phaser';
import { DODGE, type CombatEvent } from '@mictlan/core';
import { actionSlots } from '../action-bar';
import { effectsFromEvents, liveEffects, type AttackEffect } from '../attack-effects';
import { DestinationMarker } from '../click-move';
import { groupFrameAt } from '../frames';
import { recordHitFlashes, type HitFlashes } from '../hit-flash';
import { latestRejection, rejectionFlash } from '../hud-text';
import { PositionHistory, type Positions } from '../interpolation';
import { keyAction, type KeyAction } from '../keyboard';
import { isSyncedSnapshot, type Point, type RoomSnapshot } from '../snapshot';
import { allyAt, nextEnemyTarget } from '../targeting';
import { WasdWalker } from '../wasd';
import type { ArenaWorld } from '../world-3d/arena-world';
import { unitAtPixel } from '../world-3d/unit-pick';
import { Hud } from './hud';
import { drawUnitBars } from './unit-bars';

export interface ArenaRoom {
  readonly sessionId: string;
  readonly state?: { toJSON(): unknown };
  send(type: string, payload?: unknown): void;
  onStateChange(callback: (state: { toJSON(): unknown }) => void): unknown;
  onMessage(type: string, callback: (payload: CombatEvent[]) => void): unknown;
}

// SPEC §3: ~100 ms of interpolation delay hides the 20 Hz server tick.
const INTERPOLATION_DELAY_MS = 100;

// T5.1: the world renders in Three.js behind; this Phaser scene keeps input and the HUD on top.
export class ArenaScene extends Phaser.Scene {
  private snapshot?: RoomSnapshot;
  private readonly history = new PositionHistory();
  private readonly destination = new DestinationMarker();
  private hitFlashes: HitFlashes = new Map();
  private effects: AttackEffect[] = [];
  private readonly walker = new WasdWalker((direction) => this.walk(direction));
  private bars!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private readonly project = (world: Point, heightMeters?: number): Point => this.world.project(world, heightMeters);

  constructor(private readonly room: ArenaRoom, private readonly world: ArenaWorld) {
    super('arena');
  }

  create(): void {
    this.bars = this.add.graphics();
    this.hud = new Hud(this);
    this.fitWorld();
    this.scale.on('resize', () => this.fitWorld());
    this.listen();
  }

  update(time: number, deltaMs: number): void {
    if (!this.snapshot) return;
    const positions: Positions = this.history.sample(performance.now() - INTERPOLATION_DELAY_MS);
    this.world.render({ snapshot: this.snapshot, positions, selfId: this.room.sessionId,
      destination: this.visibleDestination(this.snapshot), hits: this.hitFlashes, effects: this.currentEffects(), nowMs: this.time.now });
    this.bars.clear();
    drawUnitBars(this.bars, this.snapshot, positions, this.project);
    const viewport = { width: this.scale.width, height: this.scale.height, project: this.project };
    this.hud.update(this.snapshot, this.room.sessionId, time, deltaMs, viewport);
  }

  private currentEffects(): AttackEffect[] {
    this.effects = liveEffects(this.effects, this.time.now);
    return this.effects;
  }

  private visibleDestination(snapshot: RoomSnapshot): Point | undefined {
    const marker = this.destination.position;
    return marker && this.destination.visibleAt(snapshot.entities[this.room.sessionId]) ? marker : undefined;
  }

  private listen(): void {
    this.room.onStateChange((state) => this.receiveState(state.toJSON()));
    if (this.room.state) this.receiveState(this.room.state.toJSON());
    this.room.onMessage('events', (events) => this.receiveEvents(events));
    this.listenKeys();
    // Right click moves (T3.7), so the browser menu must not open over the arena.
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handleClick(pointer));
  }

  private listenKeys(): void {
    const onKeyDown = (event: KeyboardEvent) => this.handleKey(event);
    const onKeyUp = (event: KeyboardEvent) => this.walker.keyUp(event.code);
    const onBlur = () => this.walker.release();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      this.world.dispose();
    });
  }

  private receiveState(snapshot: unknown): void {
    if (!isSyncedSnapshot(snapshot)) return;
    if (snapshot.status !== 'combat') this.walker.reset();
    if (snapshot.status === 'lobby') {
      this.hud.resetReading();
      this.hitFlashes = new Map();
      this.effects = [];
    }
    this.snapshot = snapshot;
    const positions: Positions = {};
    for (const entity of Object.values(snapshot.entities)) positions[entity.id] = { x: entity.x, y: entity.y };
    this.history.record(performance.now(), positions);
  }

  private receiveEvents(events: readonly CombatEvent[]): void {
    this.hitFlashes = recordHitFlashes(this.hitFlashes, events, this.time.now);
    const reason = latestRejection(events, this.room.sessionId);
    if (reason) this.hud.showFlash(rejectionFlash(reason, this.snapshot, this.room.sessionId), this.time.now);
    if (!this.snapshot) return;
    const positions = this.history.sample(performance.now() - INTERPOLATION_DELAY_MS);
    this.effects.push(...effectsFromEvents(events, this.snapshot, positions, this.time.now));
    this.hud.receiveCombatEvents(events, this.snapshot, this.room.sessionId, positions);
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.snapshot?.status !== 'combat') return;
    if (this.walker.keyDown(event.code)) return;
    const { action, preventDefault } = keyAction(event);
    if (preventDefault) event.preventDefault();
    if (action && !event.repeat) this.perform(action, this.snapshot);
  }

  private perform(action: KeyAction, snapshot: RoomSnapshot): void {
    const selfId = this.room.sessionId;
    if (action.type === 'cycleEnemy') {
      this.selectTarget(nextEnemyTarget(snapshot, selfId, snapshot.entities[selfId]?.targetId ?? ''));
    } else if (action.type === 'ally') {
      this.selectTarget(allyAt(snapshot, selfId, action.index));
    } else if (action.type === 'stop') {
      this.stopWalking();
    } else if (action.type === 'dodge') {
      this.room.send('cast', { abilityId: DODGE.id });
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
    if (this.snapshot?.status !== 'combat') return;
    if (pointer.rightButtonDown()) return this.walkTo(pointer);
    // Group frames live in screen space and take priority over the world under them.
    const framed = groupFrameAt(this.snapshot, this.room.sessionId, { x: pointer.x, y: pointer.y });
    const positions = this.history.sample(performance.now() - INTERPOLATION_DELAY_MS);
    this.selectTarget(framed ?? unitAtPixel(this.snapshot, positions, { x: pointer.x, y: pointer.y }, this.project));
  }

  private walk(direction: Point): void {
    this.destination.clear();
    this.room.send('move', { dx: direction.x, dy: direction.y });
  }

  private walkTo(pointer: Phaser.Input.Pointer): void {
    this.walker.reset();
    const destination = this.world.pick({ x: pointer.x, y: pointer.y });
    this.destination.set(destination);
    this.room.send('moveTo', destination);
  }

  private selectTarget(entityId: string | undefined): void {
    if (entityId !== undefined) this.room.send('target', { entityId });
  }

  private fitWorld(): void {
    this.world.resize(this.scale.width, this.scale.height);
  }
}
