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
import { UnitBars } from './unit-bars';

export interface ArenaRoom {
  readonly sessionId: string;
  readonly state?: { toJSON(): unknown };
  send(type: string, payload?: unknown): void;
  onStateChange(callback: (state: { toJSON(): unknown }) => void): unknown;
  onMessage(type: string, callback: (payload: CombatEvent[]) => void): unknown;
}

export interface ArenaEnvironment {
  document: Document;
  window: Window;
  host: HTMLElement;
  now: () => number;
}

interface KeyInput { code: string; repeat?: boolean; shiftKey?: boolean; target?: unknown; preventDefault?: () => void }
interface PointerInput { clientX: number; clientY: number; button: number }
type Listener = (event: never) => void;

// SPEC §3: ~100 ms of interpolation delay hides the 20 Hz server tick.
const INTERPOLATION_DELAY_MS = 100;
const FORM_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const BUTTONS = { left: 0, right: 2 } as const;

function typingInForm(target: unknown): boolean {
  return typeof target === 'object' && target !== null && 'tagName' in target && FORM_TAGS.has(String(target.tagName));
}

// T5.2: plain DOM + Three.js arena. Owns input, the RAF loop, the HTML HUD and the 3D world's lifetime.
export class ArenaScene {
  private snapshot?: RoomSnapshot;
  private world?: ArenaWorld;
  private hud!: Hud;
  private bars!: UnitBars;
  private frame?: number;
  private lastFrameMs?: number;
  private disposed = false;
  private hitFlashes: HitFlashes = new Map();
  private effects: AttackEffect[] = [];
  private readonly history = new PositionHistory();
  private readonly destination = new DestinationMarker();
  private readonly walker = new WasdWalker((direction) => this.walk(direction));
  private readonly listeners: [EventTarget, string, Listener][] = [];
  private readonly project = (world: Point, heightMeters?: number): Point => this.world?.project(world, heightMeters) ?? world;

  constructor(private readonly room: ArenaRoom, private readonly createWorld: () => ArenaWorld,
    private readonly env: ArenaEnvironment) {}

  create(): void {
    this.hud = new Hud(this.env.document, this.env.host);
    this.bars = new UnitBars(this.env.document, this.hud.root.element);
    this.listen();
    this.room.onStateChange((state) => this.receiveState(state.toJSON()));
    this.room.onMessage('events', (events) => this.receiveEvents(events));
    if (this.room.state) this.receiveState(this.room.state.toJSON());
  }

  update(timeMs: number, deltaMs: number): void {
    if (this.disposed || !this.snapshot || !this.world) return;
    const positions: Positions = this.history.sample(timeMs - INTERPOLATION_DELAY_MS);
    this.effects = liveEffects(this.effects, timeMs);
    this.world.render({ snapshot: this.snapshot, positions, selfId: this.room.sessionId, nowMs: timeMs,
      destination: this.visibleDestination(this.snapshot), hits: this.hitFlashes, effects: this.effects });
    this.bars.update(this.snapshot, positions, this.project);
    const viewport = { width: this.env.window.innerWidth, height: this.env.window.innerHeight, project: this.project };
    this.hud.update(this.snapshot, this.room.sessionId, timeMs, deltaMs, viewport);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const [target, type, listener] of this.listeners) target.removeEventListener(type, listener as EventListener);
    this.releaseWorld();
    this.hud.root.remove();
  }

  private listen(): void {
    const { window, host } = this.env;
    this.on(window, 'keydown', (event: KeyInput) => this.handleKey(event));
    this.on(window, 'keyup', (event: KeyInput) => this.walker.keyUp(event.code));
    this.on(window, 'blur', () => this.walker.release());
    this.on(window, 'resize', () => this.world?.resize(window.innerWidth, window.innerHeight));
    this.on(host, 'pointerdown', (event: PointerInput) => this.handlePointer(event));
    // Right click walks (T3.7), so the browser menu must not open over the arena.
    this.on(host, 'contextmenu', (event: { preventDefault(): void }) => event.preventDefault());
  }

  private on<Payload>(target: EventTarget, type: string, listener: (event: Payload) => void): void {
    target.addEventListener(type, listener as unknown as EventListener);
    this.listeners.push([target, type, listener as unknown as Listener]);
  }

  private receiveState(raw: unknown): void {
    if (this.disposed || !isSyncedSnapshot(raw)) return;
    if (raw.status !== 'combat') this.walker.reset();
    if (raw.status === 'lobby') this.leaveAttempt();
    else this.ensureWorld();
    this.snapshot = raw;
    const positions: Positions = {};
    for (const entity of Object.values(raw.entities)) positions[entity.id] = { x: entity.x, y: entity.y };
    this.history.record(this.env.now(), positions);
    this.bars.sync(raw);
  }

  private leaveAttempt(): void {
    this.hud.resetReading();
    this.hud.root.visible(false);
    this.hitFlashes = new Map();
    this.effects = [];
    this.releaseWorld();
  }

  private ensureWorld(): void {
    if (this.world) return;
    this.world = this.createWorld();
    this.world.resize(this.env.window.innerWidth, this.env.window.innerHeight);
    this.schedule();
  }

  private releaseWorld(): void {
    if (this.frame !== undefined) this.env.window.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.world?.dispose();
    this.world = undefined;
  }

  private schedule(): void {
    if (this.frame !== undefined || this.disposed || !this.world) return;
    this.frame = this.env.window.requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    this.frame = undefined;
    const nowMs = this.env.now();
    this.update(nowMs, nowMs - (this.lastFrameMs ?? nowMs));
    this.lastFrameMs = nowMs;
    this.schedule();
  }

  private receiveEvents(events: readonly CombatEvent[]): void {
    if (this.disposed) return;
    const nowMs = this.env.now();
    this.hitFlashes = recordHitFlashes(this.hitFlashes, events, nowMs);
    const reason = latestRejection(events, this.room.sessionId);
    if (reason) this.hud.showFlash(rejectionFlash(reason, this.snapshot, this.room.sessionId), nowMs);
    if (!this.snapshot) return;
    const positions = this.history.sample(nowMs - INTERPOLATION_DELAY_MS);
    this.effects.push(...effectsFromEvents(events, this.snapshot, positions, nowMs));
    this.hud.receiveCombatEvents(events, this.snapshot, this.room.sessionId, positions);
  }

  private visibleDestination(snapshot: RoomSnapshot): Point | undefined {
    const marker = this.destination.position;
    return marker && this.destination.visibleAt(snapshot.entities[this.room.sessionId]) ? marker : undefined;
  }

  private handleKey(event: KeyInput): void {
    if (this.disposed || typingInForm(event.target) || this.snapshot?.status !== 'combat') return;
    if (this.walker.keyDown(event.code)) return;
    const { action, preventDefault } = keyAction({ code: event.code, shiftKey: event.shiftKey ?? false });
    if (preventDefault) event.preventDefault?.();
    if (action && !event.repeat) this.perform(action, this.snapshot);
  }

  private perform(action: KeyAction, snapshot: RoomSnapshot): void {
    const selfId = this.room.sessionId;
    if (action.type === 'cycleEnemy') this.selectTarget(nextEnemyTarget(snapshot, selfId, snapshot.entities[selfId]?.targetId ?? ''));
    else if (action.type === 'ally') this.selectTarget(allyAt(snapshot, selfId, action.index));
    else if (action.type === 'stop') this.stopWalking();
    else if (action.type === 'dodge') this.room.send('cast', { abilityId: DODGE.id });
    else this.cast(snapshot, action.slot);
  }

  private cast(snapshot: RoomSnapshot, slotNumber: number): void {
    const slot = actionSlots(snapshot, this.room.sessionId)[slotNumber - 1];
    if (!slot) return;
    // The server stops the walk for cast-time abilities, so the marker goes too.
    if (slot.hasCastTime) this.destination.clear();
    this.room.send('cast', { abilityId: slot.abilityId });
  }

  private stopWalking(): void {
    this.walker.reset();
    this.destination.clear();
    this.room.send('stop', {});
  }

  private walk(direction: Point): void {
    this.destination.clear();
    this.room.send('move', { dx: direction.x, dy: direction.y });
  }

  private handlePointer(event: PointerInput): void {
    if (this.disposed || this.snapshot?.status !== 'combat') return;
    const bounds = this.env.host.getBoundingClientRect();
    const pixel = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (event.button === BUTTONS.right) this.walkTo(pixel);
    else if (event.button === BUTTONS.left) this.select(pixel, this.snapshot);
  }

  private select(pixel: Point, snapshot: RoomSnapshot): void {
    // Group frames live in screen space and take priority over the world under them.
    const framed = groupFrameAt(snapshot, this.room.sessionId, pixel);
    const positions = this.history.sample(this.env.now() - INTERPOLATION_DELAY_MS);
    this.selectTarget(framed ?? unitAtPixel(snapshot, positions, pixel, this.project));
  }

  private walkTo(pixel: Point): void {
    if (!this.world) return;
    this.walker.reset();
    const destination = this.world.pick(pixel);
    this.destination.set(destination);
    this.room.send('moveTo', destination);
  }

  private selectTarget(entityId: string | undefined): void {
    if (entityId !== undefined) this.room.send('target', { entityId });
  }
}
