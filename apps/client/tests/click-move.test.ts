import { expect, test } from 'vitest';
import { ARRIVAL_RADIUS_METERS, DestinationMarker } from '../src/click-move';

test('a new marker has no destination', () => {
  const marker = new DestinationMarker();
  expect(marker.position).toBeUndefined();
  expect(marker.visibleAt({ x: 0, y: 0 })).toBe(false);
});

test('setting a destination shows it until the player arrives', () => {
  const marker = new DestinationMarker();
  marker.set({ x: 3, y: -4 });
  expect(marker.position).toEqual({ x: 3, y: -4 });
  expect(marker.visibleAt({ x: 0, y: 0 })).toBe(true);
  expect(marker.visibleAt({ x: 3, y: -4 + ARRIVAL_RADIUS_METERS + 0.01 })).toBe(true);
  expect(marker.visibleAt({ x: 3, y: -4 + ARRIVAL_RADIUS_METERS })).toBe(false);
  expect(marker.position).toBeUndefined();
});

test('clearing hides the marker', () => {
  const marker = new DestinationMarker();
  marker.set({ x: 1, y: 1 });
  marker.clear();
  expect(marker.visibleAt({ x: 10, y: 10 })).toBe(false);
});

test('a missing self keeps the marker until it can be checked', () => {
  const marker = new DestinationMarker();
  marker.set({ x: 1, y: 1 });
  expect(marker.visibleAt(undefined)).toBe(true);
});

test('the arrival radius matches one server step plus a little slack', () => {
  expect(ARRIVAL_RADIUS_METERS).toBe(0.5);
});
