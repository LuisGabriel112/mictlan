import type * as Phaser from 'phaser';
import { actionSlots, type ActionSlot } from '../action-bar';
import { selfText, slotLabel, statusText, targetText } from '../hud-text';
import type { RoomSnapshot } from '../snapshot';

const LAYOUT = { margin: 16, slotWidth: 132, slotHeight: 54, slotGap: 8, flashMs: 1500 } as const;
const TEXT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#ffffff' } as const;

interface SlotView {
  key: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  caption: Phaser.GameObjects.Text;
}

function hexColor(tint: number): string {
  return `#${tint.toString(16).padStart(6, '0')}`;
}

export class Hud {
  readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly slotBoxes: Phaser.GameObjects.Graphics;
  private readonly slots: SlotView[] = [];
  private readonly self: Phaser.GameObjects.Text;
  private readonly target: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly flash: Phaser.GameObjects.Text;
  private flashUntilMs = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.slotBoxes = this.track(scene.add.graphics());
    this.self = this.text(LAYOUT.margin, LAYOUT.margin);
    this.target = this.text(LAYOUT.margin, LAYOUT.margin + 24);
    this.status = this.text(0, LAYOUT.margin, '28px').setOrigin(0.5, 0);
    this.flash = this.text(0, 0, '18px').setOrigin(0.5, 1).setColor('#ffd166');
    for (let index = 0; index < 4; index += 1) this.slots.push(this.slotView());
  }

  showFlash(message: string, nowMs: number): void {
    this.flash.setText(message);
    this.flashUntilMs = nowMs + LAYOUT.flashMs;
  }

  update(snapshot: RoomSnapshot, selfId: string, nowMs: number): void {
    const { width, height } = this.scene.scale;
    this.self.setText(selfText(snapshot, selfId));
    this.target.setText(targetText(snapshot, selfId));
    this.status.setText(statusText(snapshot)).setPosition(width / 2, LAYOUT.margin);
    this.flash.setVisible(nowMs < this.flashUntilMs).setPosition(width / 2, height - LAYOUT.slotHeight - 2 * LAYOUT.margin);
    this.drawSlots(actionSlots(snapshot, selfId), width, height);
  }

  private drawSlots(slots: readonly ActionSlot[], width: number, height: number): void {
    const totalWidth = 4 * LAYOUT.slotWidth + 3 * LAYOUT.slotGap;
    const top = height - LAYOUT.slotHeight - LAYOUT.margin;
    this.slotBoxes.clear();
    this.slots.forEach((view, index) => {
      const left = (width - totalWidth) / 2 + index * (LAYOUT.slotWidth + LAYOUT.slotGap);
      this.drawSlot(view, slots[index], left, top);
    });
  }

  private drawSlot(view: SlotView, slot: ActionSlot | undefined, left: number, top: number): void {
    const label = slot ? slotLabel(slot) : { caption: '', tint: 0x444444 };
    this.slotBoxes.fillStyle(0x1d1726, 0.9).fillRect(left, top, LAYOUT.slotWidth, LAYOUT.slotHeight);
    this.slotBoxes.lineStyle(2, label.tint, 1).strokeRect(left, top, LAYOUT.slotWidth, LAYOUT.slotHeight);
    view.key.setText(slot?.key ?? '').setPosition(left + 6, top + 4);
    view.name.setText(slot?.name ?? '').setPosition(left + 6, top + 20).setColor(hexColor(label.tint));
    view.caption.setText(label.caption).setPosition(left + LAYOUT.slotWidth - 6, top + 4).setOrigin(1, 0);
  }

  private slotView(): SlotView {
    return { key: this.text(0, 0, '12px'), name: this.text(0, 0, '13px'), caption: this.text(0, 0, '12px') };
  }

  private text(x: number, y: number, fontSize: string = TEXT_STYLE.fontSize): Phaser.GameObjects.Text {
    return this.track(this.scene.add.text(x, y, '', { ...TEXT_STYLE, fontSize }));
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }
}
