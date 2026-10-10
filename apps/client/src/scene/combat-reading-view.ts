import type { CombatEvent } from '@mictlan/core';
import { appendCombatLog, combatLogLines, COMBAT_LOG_LIMIT } from '../combat-log';
import { encounterHeader } from '../encounter-clock';
import { ageFloatingTexts, enqueueFloatingTexts, floatingTextPose, type FloatingText } from '../floating-texts';
import type { Rect } from '../frames';
import type { Positions } from '../interpolation';
import { floatingTextVisible, projectFloatingText, readingLayout, type ReadingViewport } from '../reading-layout';
import type { RoomSnapshot } from '../snapshot';
import { HudNode } from './hud-node';

// DOM text has no measured width here; an average glyph ratio is enough to keep numbers off the HUD.
const GLYPH_WIDTH_RATIO = 0.6;

function labelBounds(entry: FloatingText, point: { x: number; y: number }): Rect {
  const width = entry.text.length * entry.fontSize * GLYPH_WIDTH_RATIO;
  return { x: point.x - width / 2, y: point.y - entry.fontSize, width, height: entry.fontSize };
}

export class CombatReadingView {
  private readonly header: HudNode;
  private readonly log: HudNode;
  private readonly rows: HudNode[] = [];
  private readonly labels: HudNode[] = [];
  private floatingQueue: FloatingText[] = [];
  private lines: string[] = [];

  constructor(private readonly document: Document, private readonly parent: HTMLElement) {
    this.header = new HudNode(document, parent, 'hud-header');
    this.log = new HudNode(document, parent, 'hud-log');
    new HudNode(document, this.log.element, 'hud-log-title').text('Combate');
    for (let index = 0; index < COMBAT_LOG_LIMIT; index += 1) this.rows.push(new HudNode(document, this.log.element, 'hud-log-row'));
  }

  receive(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string, positions: Positions): void {
    this.lines = appendCombatLog(this.lines, combatLogLines(events, snapshot, selfId));
    this.floatingQueue = enqueueFloatingTexts(this.floatingQueue, events, snapshot, positions);
    // Labels are created here, never in update, so the render loop does not allocate DOM nodes.
    while (this.labels.length < this.floatingQueue.length) this.labels.push(new HudNode(this.document, this.parent, 'hud-floating'));
  }

  reset(): void {
    this.lines = [];
    this.floatingQueue = [];
  }

  update(snapshot: RoomSnapshot, deltaMs: number, viewport: ReadingViewport): void {
    const layout = readingLayout(viewport.width, viewport.height);
    const shown = snapshot.status !== 'lobby';
    this.header.text(encounterHeader(snapshot)).place(layout.header).visible(shown);
    this.log.place(layout.log).visible(shown);
    this.rows.forEach((row, index) => row.text(this.lines[index] ?? '').visible(index < this.lines.length));
    this.floatingQueue = ageFloatingTexts(this.floatingQueue, deltaMs);
    this.labels.forEach((label, index) => this.drawLabel(label, this.floatingQueue[index], viewport, layout.protectedRects));
  }

  private drawLabel(label: HudNode, entry: FloatingText | undefined, viewport: ReadingViewport, obstacles: readonly Rect[]): void {
    if (!entry) {
      label.visible(false);
      return;
    }
    const pose = floatingTextPose(entry);
    const point = projectFloatingText(pose, viewport);
    label.text(entry.text).style('transform', `translate(${point.x}px, ${point.y}px)`).style('color', entry.color)
      .style('opacity', String(pose.alpha)).style('fontSize', `${entry.fontSize}px`)
      .visible(floatingTextVisible(labelBounds(entry, point), viewport, obstacles));
  }
}
