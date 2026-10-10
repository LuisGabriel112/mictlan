import type { CombatEvent } from '@mictlan/core';
import { actionSlots, dodgeSlot, type ActionSlot } from '../action-bar';
import { bossCastBar, groupFrameRect, groupFrames, selfFrame, targetFrame, type Rect } from '../frames';
import { slotLabel, statusText } from '../hud-text';
import type { Positions } from '../interpolation';
import { HUD_LAYOUT as LAYOUT, actionSlotRects, dodgeSlotRect, readingLayout, unitFrameRects, type ReadingViewport } from '../reading-layout';
import type { RoomSnapshot } from '../snapshot';
import { CombatReadingView } from './combat-reading-view';
import { CastBarWidget, FrameWidget } from './frame-view';
import { HudNode, hexColor } from './hud-node';

interface SlotView { root: HudNode; key: HudNode; name: HudNode; caption: HudNode }

const SLOT_COUNT = 5;

function slotView(document: Document, parent: HTMLElement): SlotView {
  const root = new HudNode(document, parent, 'hud-slot');
  return { root, key: new HudNode(document, root.element, 'hud-slot-key', 'span'),
    name: new HudNode(document, root.element, 'hud-slot-name', 'span'),
    caption: new HudNode(document, root.element, 'hud-slot-caption', 'span') };
}

function drawSlot(view: SlotView, slot: ActionSlot | undefined, rect: Rect): void {
  const label = slot ? slotLabel(slot) : { caption: '', tint: 0x444444 };
  view.root.place(rect).style('borderColor', hexColor(label.tint));
  view.key.text(slot?.key ?? '');
  view.name.text(slot?.name ?? '').style('color', hexColor(label.tint));
  view.caption.text(label.caption);
}

export class Hud {
  readonly root: HudNode;
  private readonly reading: CombatReadingView;
  private readonly frames: { self: FrameWidget; target: FrameWidget; group: FrameWidget[] };
  private readonly casts: { own: CastBarWidget; target: CastBarWidget; boss: CastBarWidget };
  private readonly status: HudNode;
  private readonly flash: HudNode;
  private readonly slots: SlotView[];
  private flashUntilMs = 0;

  constructor(document: Document, parent: HTMLElement) {
    this.root = new HudNode(document, parent, 'arena-hud');
    const host = this.root.element;
    this.reading = new CombatReadingView(document, host);
    this.frames = { self: new FrameWidget(document, host), target: new FrameWidget(document, host),
      group: Array.from({ length: LAYOUT.maxGroup }, () => new FrameWidget(document, host)) };
    this.casts = { own: new CastBarWidget(document, host), target: new CastBarWidget(document, host),
      boss: new CastBarWidget(document, host) };
    this.status = new HudNode(document, host, 'hud-status');
    this.flash = new HudNode(document, host, 'hud-flash');
    this.slots = Array.from({ length: SLOT_COUNT }, () => slotView(document, host));
  }

  showFlash(message: string, nowMs: number): void {
    this.flash.text(message);
    this.flashUntilMs = nowMs + LAYOUT.flashMs;
  }

  receiveCombatEvents(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string, positions: Positions): void {
    this.reading.receive(events, snapshot, selfId, positions);
  }

  resetReading(): void {
    this.reading.reset();
    this.flashUntilMs = 0;
  }

  update(snapshot: RoomSnapshot, selfId: string, nowMs: number, deltaMs: number, viewport: ReadingViewport): void {
    const { width, height } = viewport;
    this.root.visible(snapshot.status !== 'lobby');
    this.reading.update(snapshot, deltaMs, viewport);
    this.drawFrames(snapshot, selfId);
    this.drawCastBars(snapshot, selfId, width, height);
    this.status.text(statusText(snapshot)).style('transform', `translate(${width / 2}px, ${LAYOUT.margin}px) translateX(-50%)`);
    const flashY = this.actionTop(height) - 44;
    this.flash.visible(nowMs < this.flashUntilMs).style('transform', `translate(${width / 2}px, ${flashY}px) translate(-50%, -100%)`);
    this.drawSlots(snapshot, selfId, width, height);
  }

  private drawFrames(snapshot: RoomSnapshot, selfId: string): void {
    const [selfRect, targetRect, targetCastRect] = unitFrameRects();
    this.frames.self.draw(selfFrame(snapshot, selfId), selfRect);
    const target = targetFrame(snapshot, selfId);
    this.frames.target.draw(target, targetRect);
    this.casts.target.draw(target?.cast, targetCastRect);
    const party = groupFrames(snapshot, selfId);
    this.frames.group.forEach((widget, index) => widget.draw(party[index], groupFrameRect(index)));
  }

  private drawCastBars(snapshot: RoomSnapshot, selfId: string, width: number, height: number): void {
    this.casts.boss.draw(bossCastBar(snapshot), readingLayout(width, height).bossCast);
    const ownRect = { x: (width - LAYOUT.castBar.width) / 2, y: this.actionTop(height) - LAYOUT.castBar.height - 10, ...LAYOUT.castBar };
    this.casts.own.draw(selfFrame(snapshot, selfId)?.cast, ownRect);
  }

  private drawSlots(snapshot: RoomSnapshot, selfId: string, width: number, height: number): void {
    const bar = actionSlots(snapshot, selfId);
    const slots = [bar[0], bar[1], bar[2], bar[3], dodgeSlot(snapshot, selfId)];
    const rects = [...actionSlotRects(width, height), dodgeSlotRect(width, height)];
    this.slots.forEach((view, index) => drawSlot(view, slots[index], rects[index]));
  }

  private actionTop(height: number): number {
    return height - LAYOUT.slotHeight - LAYOUT.margin;
  }
}
