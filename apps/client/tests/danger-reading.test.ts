import { expect, test } from 'vitest';
import type * as Phaser from 'phaser';
import { unsafeRing, windWarningStyle } from '../src/danger-reading';
import { drawArena, drawZones } from '../src/scene/arena-renderer';
import { room } from './fixtures';
import { graphicsMock } from './phaser-fixtures';

test('unsafeRing returns only the annulus between the synchronized safe radius and wall', () => {
  expect(unsafeRing(room([]))).toBeUndefined();
  expect(unsafeRing(room([], { phase: 2, safeRadiusMeters: 12 }))).toBeUndefined();
  expect(unsafeRing(room([], { phase: 3, safeRadiusMeters: 16 }))).toEqual({ radiusPx: 576, widthPx: 128 });
  expect(unsafeRing(room([], { status: 'defeat', phase: 3, safeRadiusMeters: 12 }))).toEqual({ radiusPx: 512, widthPx: 256 });
});

test('windWarningStyle fills with warning progress and pulses its border with render time', () => {
  expect(windWarningStyle(40, 0)).toEqual({ fillAlpha: 0.15, borderAlpha: 0.6, borderWidth: 3 });
  expect(windWarningStyle(20, 200)).toMatchObject({ borderAlpha: 1, borderWidth: 5 });
  expect(windWarningStyle(20, 200).fillAlpha).toBeCloseTo(0.325);
  expect(windWarningStyle(0, 400)).toEqual({ fillAlpha: 0.5, borderAlpha: 0.6, borderWidth: 3 });
  expect(windWarningStyle(100, 0).fillAlpha).toBe(0.15);
});

test('drawArena shades the unsafe ring then outlines the safe radius and wall', () => {
  const graphics = graphicsMock();
  drawArena(graphics as unknown as Phaser.GameObjects.Graphics, room([], { phase: 3, safeRadiusMeters: 16 }));
  expect(graphics.lineStyle.mock.calls).toEqual([[128, 0xff4444, 0.22], [3, 0xff4444, 0.9], [4, 0xd9c08c, 1]]);
  expect(graphics.strokeCircle.mock.calls).toEqual([[0, 0, 576], [0, 0, 512], [0, 0, 640]]);
});

test('drawArena without shrink draws only the wall', () => {
  const graphics = graphicsMock();
  drawArena(graphics as unknown as Phaser.GameObjects.Graphics, room([]));
  expect(graphics.lineStyle.mock.calls).toEqual([[4, 0xd9c08c, 1]]);
});

test('drawZones draws fill and animated outlines at fixed warning centers', () => {
  const graphics = graphicsMock();
  const snapshot = room([], { zones: { w: { id: 'w', x: 2, y: 3, radiusMeters: 4, remainingTicks: 20 } } });
  drawZones(graphics as unknown as Phaser.GameObjects.Graphics, snapshot, 200);
  expect(graphics.fillStyle.mock.calls[0][0]).toBe(0xff2222);
  expect(graphics.fillStyle.mock.calls[0][1]).toBeCloseTo(0.325);
  expect(graphics.fillCircle).toHaveBeenCalledWith(64, -96, 128);
  expect(graphics.lineStyle).toHaveBeenCalledWith(5, 0xff2222, 1);
  expect(graphics.strokeCircle).toHaveBeenCalledWith(64, -96, 128);
});
