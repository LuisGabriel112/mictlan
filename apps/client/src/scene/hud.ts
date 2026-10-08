import type * as Phaser from 'phaser';
import type { CombatEvent } from '@mictlan/core';
import { actionSlots, type ActionSlot } from '../action-bar';
import { bossCastBar, groupFrameRect, groupFrames, selfFrame, targetFrame, type Rect } from '../frames';
import { slotLabel, statusText } from '../hud-text';
import type { RoomSnapshot } from '../snapshot';
import type { Positions } from '../interpolation';
import { HUD_LAYOUT as LAYOUT, readingLayout, unitFrameRects, type ReadingViewport } from '../reading-layout';
import { CombatReadingView } from './combat-reading-view';
import { CastBarWidget, FrameWidget } from './frame-view';

const TEXT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff' } as const;

interface SlotView {
  key: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  caption: Phaser.GameObjects.Text;
}

function hexColor(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

function centered(width: number, y: number, size: { width: number; height: number }): Rect {
  return { x: (width - size.width) / 2, y, width: size.width, height: size.height };
}

export class Hud {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly panels: Phaser.GameObjects.Graphics;
  private readonly slots: SlotView[] = [];
  private readonly selfWidget: FrameWidget;
  private readonly targetWidget: FrameWidget;
  private readonly groupWidgets: FrameWidget[] = [];
  private readonly ownCast: CastBarWidget;
  private readonly targetCast: CastBarWidget;
  private readonly bossCast: CastBarWidget;
  private readonly status: Phaser.GameObjects.Text;
  private readonly flash: Phaser.GameObjects.Text;
  private flashUntilMs = 0;
  private readonly reading: CombatReadingView;

  constructor(private readonly scene: Phaser.Scene) {
    const track = (object: Phaser.GameObjects.GameObject) => this.objects.push(object);
    this.panels = scene.add.graphics();
    track(this.panels);
    this.reading = new CombatReadingView(scene, track);
    this.selfWidget = new FrameWidget(scene, track);
    this.targetWidget = new FrameWidget(scene, track);
    this.ownCast = new CastBarWidget(scene, track);
    this.targetCast = new CastBarWidget(scene, track);
    this.bossCast = new CastBarWidget(scene, track);
    this.status = this.text(0, LAYOUT.margin, '28px').setOrigin(0.5, 0);
    this.flash = this.text(0, 0, '18px').setOrigin(0.5, 1).setColor('#ffd166');
    this.createGroupAndSlots(track);
  }

  private createGroupAndSlots(track: (object: Phaser.GameObjects.GameObject) => void): void {
    for (let index = 0; index < LAYOUT.maxGroup; index += 1) this.groupWidgets.push(new FrameWidget(this.scene, track));
    for (let index = 0; index < 4; index += 1) this.slots.push(this.slotView());
  }

  showFlash(message: string, nowMs: number): void {
    this.flash.setText(message);
    this.flashUntilMs = nowMs + LAYOUT.flashMs;
  }

  receiveCombatEvents(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string, positions: Positions): void {
    this.reading.receive(events, snapshot, selfId, positions);
  }

  resetReading(): void {
    this.reading.reset();
  }

  update(snapshot: RoomSnapshot, selfId: string, nowMs: number, deltaMs: number, viewport: ReadingViewport): void {
    const { width, height } = this.scene.scale;
    this.reading.update(snapshot, deltaMs, viewport);
    this.panels.clear();
    this.drawFrames(snapshot, selfId);
    this.drawCastBars(snapshot, selfId, width, height);
    this.status.setText(statusText(snapshot)).setPosition(width / 2, LAYOUT.margin);
    this.flash.setVisible(nowMs < this.flashUntilMs).setPosition(width / 2, this.actionTop(height) - 44);
    this.drawSlots(actionSlots(snapshot, selfId), width, height);
  }

  private drawFrames(snapshot: RoomSnapshot, selfId: string): void {
    const [selfRect, targetRect, targetCastRect] = unitFrameRects();
    this.selfWidget.draw(this.panels, selfFrame(snapshot, selfId), selfRect);
    const target = targetFrame(snapshot, selfId);
    this.targetWidget.draw(this.panels, target, targetRect);
    this.targetCast.draw(this.panels, target?.cast, targetCastRect);
    const party = groupFrames(snapshot, selfId);
    this.groupWidgets.forEach((widget, index) => widget.draw(this.panels, party[index], groupFrameRect(index)));
  }

  private drawCastBars(snapshot: RoomSnapshot, selfId: string, width: number, height: number): void {
    this.bossCast.draw(this.panels, bossCastBar(snapshot), readingLayout(width, height).bossCast);
    const ownTop = this.actionTop(height) - LAYOUT.castBar.height - 10;
    this.ownCast.draw(this.panels, selfFrame(snapshot, selfId)?.cast, centered(width, ownTop, LAYOUT.castBar));
  }

  private actionTop(height: number): number {
    return height - LAYOUT.slotHeight - LAYOUT.margin;
  }

  private drawSlots(slots: readonly ActionSlot[], width: number, height: number): void {
    const totalWidth = 4 * LAYOUT.slotWidth + 3 * LAYOUT.slotGap;
    this.slots.forEach((view, index) => {
      const left = (width - totalWidth) / 2 + index * (LAYOUT.slotWidth + LAYOUT.slotGap);
      this.drawSlot(view, slots[index], left, this.actionTop(height));
    });
  }

  private drawSlot(view: SlotView, slot: ActionSlot | undefined, left: number, top: number): void {
    const label = slot ? slotLabel(slot) : { caption: '', tint: 0x444444 };
    this.panels.fillStyle(0x1d1726, 0.9).fillRect(left, top, LAYOUT.slotWidth, LAYOUT.slotHeight);
    this.panels.lineStyle(2, label.tint, 1).strokeRect(left, top, LAYOUT.slotWidth, LAYOUT.slotHeight);
    view.key.setText(slot?.key ?? '').setPosition(left + 6, top + 4);
    view.name.setText(slot?.name ?? '').setPosition(left + 6, top + 20).setColor(hexColor(label.tint));
    view.caption.setText(label.caption).setPosition(left + LAYOUT.slotWidth - 6, top + 4).setOrigin(1, 0);
  }

  private slotView(): SlotView {
    return { key: this.text(0, 0, '12px'), name: this.text(0, 0, '13px'), caption: this.text(0, 0, '12px') };
  }

  private text(x: number, y: number, fontSize: string = TEXT_STYLE.fontSize): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, '', { ...TEXT_STYLE, fontSize });
    this.objects.push(text);
    return text;
  }
}
