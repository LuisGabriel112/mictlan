import type * as Phaser from 'phaser';
import type { CombatEvent } from '@mictlan/core';
import { appendCombatLog, combatLogLines, COMBAT_LOG_LIMIT } from '../combat-log';
import { encounterHeader } from '../encounter-clock';
import { ageFloatingTexts, enqueueFloatingTexts, floatingTextPose, type FloatingText } from '../floating-texts';
import type { Positions } from '../interpolation';
import { floatingTextVisible, projectFloatingText, readingLayout, type ReadingViewport } from '../reading-layout';
import type { Rect } from '../frames';
import type { RoomSnapshot } from '../snapshot';

type Track = (object: Phaser.GameObjects.GameObject) => void;
const TEXT_STYLE = { fontFamily: 'system-ui, sans-serif', fontSize: '12px', color: '#ffffff' } as const;

export class CombatReadingView {
  private readonly panels: Phaser.GameObjects.Graphics;
  private readonly header: Phaser.GameObjects.Text;
  private readonly title: Phaser.GameObjects.Text;
  private readonly rows: Phaser.GameObjects.Text[] = [];
  private readonly floatingLabels: Phaser.GameObjects.Text[] = [];
  private floatingQueue: FloatingText[] = [];
  private log: string[] = [];

  constructor(private readonly scene: Phaser.Scene, private readonly track: Track) {
    this.panels = scene.add.graphics();
    track(this.panels);
    this.header = this.text().setOrigin(0.5, 0).setFontSize(15);
    this.title = this.text().setText('Combate').setColor('#d9c08c');
    for (let index = 0; index < COMBAT_LOG_LIMIT; index += 1) this.rows.push(this.text());
  }

  receive(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string, positions: Positions): void {
    this.log = appendCombatLog(this.log, combatLogLines(events, snapshot, selfId));
    this.floatingQueue = enqueueFloatingTexts(this.floatingQueue, events, snapshot, positions);
  }

  reset(): void {
    this.log = [];
    this.floatingQueue = [];
  }

  update(snapshot: RoomSnapshot, deltaMs: number, viewport: ReadingViewport): void {
    const layout = readingLayout(viewport.width, viewport.height);
    const visible = snapshot.status !== 'lobby';
    this.panels.clear();
    this.header.setText(encounterHeader(snapshot)).setPosition(viewport.width / 2, layout.header.y).setVisible(visible);
    this.header.setScale(Math.min(1, layout.header.width / Math.max(1, this.header.width)), 1);
    this.title.setPosition(layout.log.x + 8, layout.log.y + 8).setVisible(visible);
    if (visible) this.panels.fillStyle(0x1d1726, 0.6).fillRect(layout.log.x, layout.log.y, layout.log.width, layout.log.height);
    this.drawRows(layout.log, visible);
    this.floatingQueue = ageFloatingTexts(this.floatingQueue, deltaMs);
    this.drawFloating(viewport, layout.protectedRects);
  }

  private drawRows(rect: Rect, visible: boolean): void {
    this.rows.forEach((row, index) => {
      row.setText(this.log[index] ?? '').setVisible(visible && index < this.log.length);
      row.setPosition(rect.x + 8, rect.y + 30 + index * 18);
      row.setScale(Math.min(1, (rect.width - 16) / Math.max(1, row.width)), 1);
    });
  }

  private drawFloating(viewport: ReadingViewport, obstacles: readonly Rect[]): void {
    while (this.floatingLabels.length < this.floatingQueue.length) this.floatingLabels.push(this.text().setOrigin(0.5, 1));
    this.floatingLabels.forEach((label, index) => {
      const entry = this.floatingQueue[index];
      label.setVisible(entry !== undefined);
      if (entry) this.drawNumber(label, entry, viewport, obstacles);
    });
  }

  private drawNumber(label: Phaser.GameObjects.Text, entry: FloatingText, viewport: ReadingViewport, obstacles: readonly Rect[]): void {
    const pose = floatingTextPose(entry);
    const point = projectFloatingText(pose, viewport);
    label.setText(entry.text).setFontSize(entry.fontSize).setColor(entry.color).setAlpha(pose.alpha).setPosition(point.x, point.y);
    const bounds = { x: point.x - label.width / 2, y: point.y - label.height, width: label.width, height: label.height };
    label.setVisible(floatingTextVisible(bounds, viewport, obstacles));
  }

  private text(): Phaser.GameObjects.Text {
    const label = this.scene.add.text(0, 0, '', TEXT_STYLE);
    this.track(label);
    return label;
  }
}
