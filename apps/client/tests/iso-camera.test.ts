import { expect, test } from 'vitest';
import { ISO_VIEW, isoCamera, pickGround, projectToScreen } from '../src/world-3d/iso-camera';

const SIZES = [[1280, 720], [720, 1280], [800, 800], [1920, 600]] as const;

function close(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

test.each(SIZES)('%i×%i keeps the arena center on the screen center', (width, height) => {
  close(projectToScreen(isoCamera(width, height), { x: 0, y: 0 }), { x: width / 2, y: height / 2 });
});

test.each(SIZES)('%i×%i fits the whole arena plus margin on screen', (width, height) => {
  const camera = isoCamera(width, height);
  for (let degrees = 0; degrees < 360; degrees += 15) {
    const angle = degrees * Math.PI / 180;
    const edge = { x: Math.cos(angle) * ISO_VIEW.fitRadiusMeters, y: Math.sin(angle) * ISO_VIEW.fitRadiusMeters };
    const pixel = projectToScreen(camera, edge);
    expect(pixel.x).toBeGreaterThanOrEqual(-1e-6);
    expect(pixel.x).toBeLessThanOrEqual(width + 1e-6);
    expect(pixel.y).toBeGreaterThanOrEqual(-1e-6);
    expect(pixel.y).toBeLessThanOrEqual(height + 1e-6);
  }
});

test('the frustum keeps the window aspect ratio and grows on the tight axis', () => {
  const wide = isoCamera(1920, 600);
  expect(wide.halfWidth / wide.halfHeight).toBeCloseTo(1920 / 600, 6);
  expect(wide.halfHeight).toBeCloseTo(ISO_VIEW.fitRadiusMeters * Math.sin(ISO_VIEW.elevationRadians)
    + ISO_VIEW.headroomMeters * Math.cos(ISO_VIEW.elevationRadians), 6);
  const tall = isoCamera(720, 1280);
  expect(tall.halfWidth).toBeCloseTo(ISO_VIEW.fitRadiusMeters, 6);
});

test('the camera looks from the southeast and above toward the center', () => {
  const { position, forward } = isoCamera(1280, 720);
  expect(position.x).toBeGreaterThan(0);
  expect(position.y).toBeGreaterThan(0);
  expect(position.z).toBeGreaterThan(0);
  expect(Math.atan2(position.y, Math.hypot(position.x, position.z))).toBeCloseTo(ISO_VIEW.elevationRadians, 6);
  expect(Math.hypot(forward.x, forward.y, forward.z)).toBeCloseTo(1, 6);
});

test.each(SIZES)('%i×%i picks the ground under a pixel and projects back to it', (width, height) => {
  const camera = isoCamera(width, height);
  for (const pixel of [{ x: 0, y: 0 }, { x: width, y: height }, { x: width * 0.3, y: height * 0.8 }]) {
    close(projectToScreen(camera, pickGround(camera, pixel)), pixel);
  }
});

test('world north appears up on screen and east to the right', () => {
  const camera = isoCamera(1280, 720);
  const center = projectToScreen(camera, { x: 0, y: 0 });
  expect(projectToScreen(camera, { x: 0, y: 5 }).y).toBeLessThan(center.y);
  expect(projectToScreen(camera, { x: 5, y: 0 }).x).toBeGreaterThan(center.x);
});

test('height lifts a projected point upward on screen', () => {
  const camera = isoCamera(1280, 720);
  const ground = projectToScreen(camera, { x: 3, y: 2 });
  const lifted = projectToScreen(camera, { x: 3, y: 2 }, 2);
  expect(lifted.x).toBeCloseTo(ground.x, 6);
  expect(lifted.y).toBeLessThan(ground.y);
});

test('an empty window still produces a finite camera', () => {
  const camera = isoCamera(0, 0);
  expect(Number.isFinite(camera.halfWidth)).toBe(true);
  expect(Number.isFinite(camera.halfHeight)).toBe(true);
});
