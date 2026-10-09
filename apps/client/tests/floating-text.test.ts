import { describe, expect, it } from 'vitest';
import type { CombatEvent } from '@mictlan/core';
import { ageFloatingTexts, emptyFloatingTexts, enqueueFloatingTexts, floatingTextMotion, floatingTextVisible } from '../src/floating-text';
import { floatingTextPanels, HUD_LAYOUT } from '../src/hud-layout';

const damage: CombatEvent = { type: 'damage', tick: 1, sourceId: 'boss', targetId: 'self', abilityId: 'autoAttack', amount: 60, critical: false };
const healing: CombatEvent = { type: 'healing', tick: 1, sourceId: 'healer', targetId: 'self', abilityId: 'remedy', amount: 180, effectiveAmount: 120, critical: false };
const positions = { self: { x: 3, y: -5 } };

describe('floating text queue', () => {
  it('enqueues one number per visible damage or effective healing, including lethal damage', () => {
    const initial = emptyFloatingTexts();
    const queue = enqueueFloatingTexts(initial, [damage, healing], positions);
    expect(queue.texts).toMatchObject([
      { id: 0, x: 3, y: -5, text: '60', color: '#ffffff', fontSize: 18, ageMs: 0, lifetimeMs: 1000 },
      { id: 1, x: 3, y: -5, text: '+120', color: '#4cd964', fontSize: 18, ageMs: 0, lifetimeMs: 1000 },
    ]);
    expect(initial.texts).toEqual([]);
    expect(queue.texts[0].lane).not.toBe(queue.texts[1].lane);
  });

  it('makes damage crits yellow and larger, and keeps critical healing green with a plus', () => {
    const queue = enqueueFloatingTexts(emptyFloatingTexts(), [{ ...damage, critical: true }, { ...healing, critical: true }], positions);
    expect(queue.texts).toMatchObject([{ text: '60', color: '#ffe066', fontSize: 25 }, { text: '+120', color: '#4cd964', fontSize: 25 }]);
  });

  it('ignores absent entities, zero effective healing and unrelated events', () => {
    const queue = enqueueFloatingTexts(emptyFloatingTexts(), [
      { ...damage, targetId: 'absent' }, { ...healing, effectiveAmount: 0 }, { type: 'enraged', tick: 1, sourceId: 'boss' },
    ], positions);
    expect(queue).toEqual(emptyFloatingTexts());
  });

  it('rises and fades, expires at one second and keeps staggered arrivals independent', () => {
    const first = enqueueFloatingTexts(emptyFloatingTexts(), [damage], positions);
    const halfway = ageFloatingTexts(first, 500);
    expect(halfway.texts[0].ageMs).toBe(500);
    expect(floatingTextMotion(halfway.texts[0])).toEqual({ alpha: 0.5, offsetY: -24 });
    expect(first.texts[0].ageMs).toBe(0);
    const second = enqueueFloatingTexts(halfway, [healing], positions);
    expect(ageFloatingTexts(second, 499).texts).toHaveLength(2);
    const expired = ageFloatingTexts(second, 500);
    expect(expired.texts).toMatchObject([{ id: 1, ageMs: 500 }]);
    expect(ageFloatingTexts(expired, 500).texts).toEqual([]);
    expect(enqueueFloatingTexts(ageFloatingTexts(expired, 500), [damage], positions).texts[0].id).toBe(2);
  });

  it('anchors the number at receipt position without mutating or following later positions', () => {
    const visible = { self: { x: 3, y: -5 } };
    const queue = enqueueFloatingTexts(emptyFloatingTexts(), [damage], visible);
    visible.self.x = 10;
    expect(queue.texts[0].x).toBe(3);
  });
});

describe('floating text HUD occlusion', () => {
  const viewport = { x: 0, y: 0, width: 1280, height: 720 };
  const log = { x: 900, y: 320, width: 360, height: 270 };
  const panels = floatingTextPanels(viewport.width, viewport.height, log);
  it.each([
    ['self frame', 20, 20], ['target frame', 310, 30], ['group frame', 30, 160],
    ['last group frame', 30, 340], ['action bar', 550, 660], ['own cast', 550, 620],
    ['clock', 550, HUD_LAYOUT.clockTop], ['boss cast', 550, HUD_LAYOUT.bossCastTop], ['log', 1000, 350],
  ] as const)('does not cover the %s', (_name, x, y) => {
    expect(floatingTextVisible({ x, y, width: 50, height: 25 }, viewport, panels)).toBe(false);
  });

  it('shows arena numbers and hides them as their full bounds rise into the HUD', () => {
    expect(floatingTextVisible({ x: 600, y: 250, width: 50, height: 25 }, viewport, panels)).toBe(true);
    expect(floatingTextVisible({ x: 220, y: 160, width: 50, height: 25 }, viewport, panels)).toBe(false);
    expect(floatingTextVisible({ x: -100, y: 400, width: 50, height: 25 }, viewport, panels)).toBe(false);
  });

  it('leaves a gap between the encounter clock and the boss cast', () => {
    expect(HUD_LAYOUT.clockTop + 20).toBeLessThan(HUD_LAYOUT.bossCastTop);
  });
});
