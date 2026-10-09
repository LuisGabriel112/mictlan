import type { CombatEvent } from '@mictlan/core';
import type { Rect } from './frames';
import type { Positions } from './interpolation';
import type { Point } from './snapshot';

export const FLOATING_TEXT = { lifetimeMs: 1000, risePx: 48, fontSize: 18, criticalFontSize: 25,
  damageColor: '#ffffff', criticalColor: '#ffe066', healingColor: '#4cd964' } as const;

export interface FloatingText extends Point {
  id: number;
  text: string;
  ageMs: number;
  lifetimeMs: number;
  color: string;
  fontSize: number;
  lane: number;
}

export interface FloatingTextQueue {
  nextId: number;
  texts: readonly FloatingText[];
}

export function emptyFloatingTexts(): FloatingTextQueue {
  return { nextId: 0, texts: [] };
}

// Positions are the visible, interpolated positions in meters at receipt time.
export function enqueueFloatingTexts(queue: FloatingTextQueue, events: readonly CombatEvent[], positions: Positions): FloatingTextQueue {
  const texts = [...queue.texts];
  let nextId = queue.nextId;
  for (const event of events) {
    if (event.type !== 'damage' && event.type !== 'healing') continue;
    const position = positions[event.targetId];
    if (!position || (event.type === 'healing' && event.effectiveAmount <= 0)) continue;
    const healing = event.type === 'healing';
    texts.push({
      id: nextId++, x: position.x, y: position.y, ageMs: 0, lifetimeMs: FLOATING_TEXT.lifetimeMs,
      text: healing ? `+${event.effectiveAmount}` : String(event.amount),
      color: healing ? FLOATING_TEXT.healingColor : event.critical ? FLOATING_TEXT.criticalColor : FLOATING_TEXT.damageColor,
      fontSize: event.critical ? FLOATING_TEXT.criticalFontSize : FLOATING_TEXT.fontSize,
      lane: texts.filter((text) => text.x === position.x && text.y === position.y).length % 3,
    });
  }
  return { nextId, texts };
}

export function ageFloatingTexts(queue: FloatingTextQueue, dtMs: number): FloatingTextQueue {
  return { ...queue, texts: queue.texts.map((text) => ({ ...text, ageMs: text.ageMs + Math.max(0, dtMs) }))
    .filter((text) => text.ageMs < text.lifetimeMs) };
}

export function floatingTextMotion(text: FloatingText): { alpha: number; offsetY: number } {
  const progress = Math.min(1, text.ageMs / text.lifetimeMs);
  return { alpha: 1 - progress, offsetY: -FLOATING_TEXT.risePx * progress };
}

export function floatingTextVisible(bounds: Rect, viewport: Rect, panels: readonly Rect[]): boolean {
  const overlaps = (other: Rect) => bounds.x < other.x + other.width && bounds.x + bounds.width > other.x
    && bounds.y < other.y + other.height && bounds.y + bounds.height > other.y;
  return overlaps(viewport) && !panels.some(overlaps);
}
