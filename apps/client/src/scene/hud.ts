import type * as Phaser from 'phaser';
import { actionSlots, type ActionSlot } from '../action-bar';
import { appendCombatLog } from '../combat-log';
import { encounterClockText } from '../encounter-clock';
import { floatingTextPanels, HUD_LAYOUT as LAYOUT } from '../hud-layout';
import { bossCastBar, groupFrameRect, groupFrames, selfFrame, targetFrame, type Rect } from '../frames';
import { slotLabel, statusText } from '../hud-text';
import type { RoomSnapshot } from '../snapshot';
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
  private readonly clock: Phaser.GameObjects.Text;
  private readonly combatLog: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private logRect: Rect = { x: 0, y: 0, width: 0, height: 0 };
  private flashUntilMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const track = (object: Phaser.GameObjects.GameObject) => this.objects.push(object);
    this.panels = scene.add.graphics();
    track(this.panels);
    this.selfWidget = new FrameWidget(scene, track);
    this.targetWidget = new FrameWidget(scene, track);
    for (let index = 0; index < LAYOUT.maxGroup; index += 1) this.groupWidgets.push(new FrameWidget(scene, track));
    this.ownCast = new CastBarWidget(scene, track);
    this.targetCast = new CastBarWidget(scene, track);
    this.bossCast = new CastBarWidget(scene, track);
    this.status = this.text(0, LAYOUT.margin, '28px').setOrigin(0.5, 0);
    this.flash = this.text(0, 0, '18px').setOrigin(0.5, 1).setColor('#ffd166');
    this.clock = this.text(0, 0).setOrigin(0.5, 0);
    this.combatLog = this.text(0, 0, '12px').setLineSpacing(3);
    for (let index = 0; index < 4; index += 1) this.slots.push(this.slotView());
  }

  appendLog(lines: readonly string[]): void {
    this.logLines = appendCombatLog(this.logLines, lines);
  }

  clearLog(): void {
    this.logLines = [];
  }

  get floatingTextOcclusions(): Rect[] {
    return floatingTextPanels(this.scene.scale.width, this.scene.scale.height, this.logRect);
  }

  showFlash(message: string, nowMs: number): void {
    this.flash.setText(message);
    this.flashUntilMs = nowMs + LAYOUT.flashMs;
  }

  update(snapshot: RoomSnapshot, selfId: string, nowMs: number): void {
    const { width, height } = this.scene.scale;
    this.panels.clear();
    this.drawFrames(snapshot, selfId);
    this.drawCastBars(snapshot, selfId, width, height);
    // The DOM result screen owns victory/defeat; the HUD only labels the dev lobby.
    this.status.setVisible(snapshot.status === 'lobby').setText(statusText(snapshot)).setPosition(width / 2, LAYOUT.margin);
    this.clock.setText(encounterClockText(snapshot)).setPosition(width / 2, LAYOUT.clockTop);
    this.flash.setVisible(nowMs < this.flashUntilMs).setPosition(width / 2, this.actionTop(height) - 44);
    this.drawSlots(actionSlots(snapshot, selfId), width, height);
    this.drawCombatLog(snapshot, width, height);
  }

  private drawCombatLog(snapshot: RoomSnapshot, width: number, height: number): void {
    this.combatLog.setVisible(snapshot.status !== 'lobby');
    this.logRect = { x: 0, y: 0, width: 0, height: 0 };
    if (snapshot.status === 'lobby') return;
    const padding = LAYOUT.logPadding;
    const panelWidth = Math.min(560, width * 0.45);
    this.combatLog.setWordWrapWidth(panelWidth - padding * 2, true)
      .setText(['Combate', ...this.logLines].join('\n'));
    this.logRect = {
      x: width - panelWidth - LAYOUT.margin,
      y: height - LAYOUT.logBottomGap - this.combatLog.height - padding * 2,
      width: panelWidth, height: this.combatLog.height + padding * 2,
    };
    const rect = this.logRect;
    this.panels.fillStyle(0x1d1726, 0.94).fillRect(rect.x, rect.y, rect.width, rect.height);
    this.combatLog.setPosition(rect.x + padding, rect.y + padding);
  }

  private drawFrames(snapshot: RoomSnapshot, selfId: string): void {
    const { margin, unitFrame } = LAYOUT;
    this.selfWidget.draw(this.panels, selfFrame(snapshot, selfId), { x: margin, y: margin, ...unitFrame });
    const targetRect = { x: 2 * margin + unitFrame.width, y: margin, ...unitFrame };
    const target = targetFrame(snapshot, selfId);
    this.targetWidget.draw(this.panels, target, targetRect);
    this.targetCast.draw(this.panels, target?.cast, { ...targetRect, y: targetRect.y + unitFrame.height + 4, height: 18 });
    const party = groupFrames(snapshot, selfId);
    this.groupWidgets.forEach((widget, index) => widget.draw(this.panels, party[index], groupFrameRect(index)));
  }

  private drawCastBars(snapshot: RoomSnapshot, selfId: string, width: number, height: number): void {
    this.bossCast.draw(this.panels, bossCastBar(snapshot), centered(width, LAYOUT.bossCastTop, LAYOUT.castBar));
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
