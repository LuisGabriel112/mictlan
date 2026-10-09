import { expect, test } from 'vitest';
import { hitFlashFor, recordHitFlashes } from '../src/hit-flash';
import { HIT_FLASH_COLORS } from '../src/palette';
import { hit } from './hit-flash-fixtures';

test('an entity without hits has no flash and unit scale', () => {
  expect(hitFlashFor(new Map(), 'boss', 900)).toEqual({ intensity: 0, scale: 1, color: 0xffffff });
});

test.each([[0, 1], [50, 0.75], [100, 0.5], [199, 0.005], [200, 0], [500, 0]])(
  'normal damage fades linearly after %i ms', (elapsed, intensity) => {
    const flashes = recordHitFlashes(new Map(), [hit()], 1000);
    const pose = hitFlashFor(flashes, 'boss', 1000 + elapsed);
    expect(pose.intensity).toBeCloseTo(intensity);
    expect(pose.scale).toBeCloseTo(1 + 0.06 * intensity);
    expect(pose.color).toBe(HIT_FLASH_COLORS.normal);
  },
);

test.each([[0, 1], [140, 0.5], [200, 2 / 7], [280, 0], [400, 0]])(
  'critical damage has a stronger yellow pulse after %i ms', (elapsed, intensity) => {
    const flashes = recordHitFlashes(new Map(), [hit('boss', true)], 5000);
    const pose = hitFlashFor(flashes, 'boss', 5000 + elapsed);
    expect(pose.intensity).toBeCloseTo(intensity);
    expect(pose.scale).toBeCloseTo(1 + 0.1 * intensity);
    expect(pose.color).toBe(HIT_FLASH_COLORS.critical);
  },
);

test('flash colors are white for normal hits and yellow for critical hits', () => {
  expect(HIT_FLASH_COLORS).toEqual({ normal: 0xffffff, critical: 0xffe066 });
});

test('repeated hits restart instead of accumulating and leave their input unchanged', () => {
  const original = recordHitFlashes(new Map(), [hit('boss', true), hit('other')], 0);
  const restarted = recordHitFlashes(original, [hit(), hit()], 100);
  expect(hitFlashFor(restarted, 'boss', 100)).toEqual({ intensity: 1, scale: 1.06, color: 0xffffff });
  expect(hitFlashFor(restarted, 'boss', 200).intensity).toBe(0.5);
  expect(hitFlashFor(restarted, 'other', 100).intensity).toBe(0.5);
  expect(hitFlashFor(original, 'boss', 140)).toEqual({ intensity: 0.5, scale: 1.05, color: 0xffe066 });
  expect(restarted.size).toBe(2);
});

test('the last damage in a batch controls the pulse', () => {
  const flashes = recordHitFlashes(new Map(), [hit(), hit('boss', true)], 0);
  expect(hitFlashFor(flashes, 'boss', 0)).toEqual({ intensity: 1, scale: 1.1, color: 0xffe066 });
});

test('non-damage events cannot start or restart a flash', () => {
  const original = recordHitFlashes(new Map(), [hit()], 0);
  const events = [{ type: 'healing', tick: 1, sourceId: 'h', targetId: 'boss',
    abilityId: 'remedy', amount: 120, effectiveAmount: 120, critical: true } as const];
  expect(recordHitFlashes(new Map(), events, 100).size).toBe(0);
  expect(hitFlashFor(recordHitFlashes(original, events, 100), 'boss', 100).intensity).toBe(0.5);
  expect(recordHitFlashes(original, [], 500)).toEqual(original);
});

test('only injected timestamps determine the pose and clamp a backwards clock', () => {
  const flashes = recordHitFlashes(new Map(), [hit()], 987654);
  expect(hitFlashFor(flashes, 'boss', 987754).intensity).toBe(0.5);
  expect(hitFlashFor(flashes, 'boss', 987754).intensity).toBe(0.5);
  expect(hitFlashFor(flashes, 'boss', 0)).toEqual({ intensity: 1, scale: 1.06, color: 0xffffff });
});

test('three staggered attackers leave no accumulated flash after the last pulse expires', () => {
  const first = recordHitFlashes(new Map(), [hit()], 0);
  const second = recordHitFlashes(first, [hit()], 100);
  const third = recordHitFlashes(second, [hit()], 150);
  expect(hitFlashFor(third, 'boss', 250).intensity).toBe(0.5);
  expect(hitFlashFor(third, 'boss', 350).intensity).toBe(0);
});
