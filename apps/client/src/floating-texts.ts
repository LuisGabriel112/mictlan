import type { CombatEvent } from '@mictlan/core';
import type { Positions } from './interpolation';
import type { Point, RoomSnapshot } from './snapshot';

export interface FloatingText extends Point {
  readonly ageMs: number;
  readonly lifetimeMs: number;
  readonly text: string;
  readonly color: string;
  readonly fontSize: number;
}

const FLOATING_STYLE = { lifetimeMs: 1000, riseMeters: 1.5, normalSize: 18, criticalSize: 26,
  damageColor: '#ffffff', criticalColor: '#ffe066', healingColor: '#4cd964' } as const;
type AmountEvent = Extract<CombatEvent, { type: 'damage' | 'healing' }>;

function amountStyle(event: AmountEvent) {
  const damageColor = event.critical ? FLOATING_STYLE.criticalColor : FLOATING_STYLE.damageColor;
  return { color: event.type === 'healing' ? FLOATING_STYLE.healingColor : damageColor,
    fontSize: event.critical ? FLOATING_STYLE.criticalSize : FLOATING_STYLE.normalSize };
}

function amountCaption(event: AmountEvent): string {
  return event.type === 'healing' ? `+${event.effectiveAmount}` : `${event.amount}`;
}

export function floatingTextFor(event: CombatEvent, snapshot: RoomSnapshot, positions: Positions): FloatingText | undefined {
  if (event.type !== 'damage' && event.type !== 'healing') return undefined;
  return visibleAmountText(event, snapshot, positions);
}

function visibleAmountText(event: AmountEvent, snapshot: RoomSnapshot, positions: Positions): FloatingText | undefined {
  const target = snapshot.entities[event.targetId];
  const amount = event.type === 'healing' ? event.effectiveAmount : event.amount;
  if (!target || amount === 0) return undefined;
  const position = positions[target.id] ?? target;
  return {
    x: position.x, y: position.y, ageMs: 0, lifetimeMs: FLOATING_STYLE.lifetimeMs,
    text: amountCaption(event), ...amountStyle(event),
  };
}

export function enqueueFloatingTexts(queue: readonly FloatingText[], events: readonly CombatEvent[],
  snapshot: RoomSnapshot, positions: Positions): FloatingText[] {
  const incoming = events.flatMap((event) => {
    const entry = floatingTextFor(event, snapshot, positions);
    return entry ? [entry] : [];
  });
  return [...queue, ...incoming];
}

export function ageFloatingTexts(queue: readonly FloatingText[], deltaMs: number): FloatingText[] {
  return queue.map((entry) => ({ ...entry, ageMs: entry.ageMs + deltaMs })).filter((entry) => entry.ageMs < entry.lifetimeMs);
}

export function floatingTextPose(entry: FloatingText): Point & { alpha: number } {
  const progress = Math.min(1, entry.ageMs / entry.lifetimeMs);
  return { x: entry.x, y: entry.y + FLOATING_STYLE.riseMeters * progress, alpha: 1 - progress };
}
