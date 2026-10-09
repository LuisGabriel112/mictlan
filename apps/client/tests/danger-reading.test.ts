import { expect, test } from 'vitest';
import { unsafeRing, windWarningStyle } from '../src/danger-reading';
import { room } from './fixtures';

test('unsafeRing returns only the annulus between the synchronized safe radius and wall', () => {
  expect(unsafeRing(room([]))).toBeUndefined();
  expect(unsafeRing(room([], { phase: 2, safeRadiusMeters: 12 }))).toBeUndefined();
  expect(unsafeRing(room([], { phase: 3, safeRadiusMeters: 16 }))).toEqual({ innerRadiusMeters: 16, outerRadiusMeters: 20 });
  expect(unsafeRing(room([], { status: 'defeat', phase: 3, safeRadiusMeters: 12 }))).toEqual({ innerRadiusMeters: 12, outerRadiusMeters: 20 });
});

test('windWarningStyle fills with warning progress and pulses its border with render time', () => {
  expect(windWarningStyle(40, 0)).toEqual({ fillAlpha: 0.15, borderAlpha: 0.6, borderWidth: 3 });
  expect(windWarningStyle(20, 200)).toMatchObject({ borderAlpha: 1, borderWidth: 5 });
  expect(windWarningStyle(20, 200).fillAlpha).toBeCloseTo(0.325);
  expect(windWarningStyle(0, 400)).toEqual({ fillAlpha: 0.5, borderAlpha: 0.6, borderWidth: 3 });
  expect(windWarningStyle(100, 0).fillAlpha).toBe(0.15);
});
