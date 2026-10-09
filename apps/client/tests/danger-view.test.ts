import { describe, expect, it } from 'vitest';
import { unsafeRing, windWarningStyle } from '../src/danger-view';

describe('danger indicators', () => {
  it.each([20, 16, 12])('shades only between the safe radius %s and the wall', (safe) => {
    const ring = unsafeRing(safe);
    expect(ring.radius - ring.width / 2).toBe(safe);
    expect(ring.radius + ring.width / 2).toBe(20);
  });

  it('fills the warning circle as detonation approaches and pulses its outline between ticks', () => {
    expect(windWarningStyle(40, 0).fillAlpha).toBe(0.15);
    expect(windWarningStyle(20, 0).fillAlpha).toBeCloseTo(0.325);
    expect(windWarningStyle(0, 0).fillAlpha).toBe(0.5);
    expect(windWarningStyle(20, 125).borderAlpha).toBeGreaterThan(windWarningStyle(20, 375).borderAlpha);
    expect(windWarningStyle(20, 125).borderWidth).toBeGreaterThan(windWarningStyle(20, 375).borderWidth);
  });
});
