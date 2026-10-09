import { vi } from 'vitest';
import type { Point } from '../src/snapshot';

// Same mapping as the old Phaser camera (16 px per meter around a 1280×720 center) so HUD expectations stay readable.
export function legacyProjection(world: Point, heightMeters = 0): Point {
  return { x: 640 + world.x * 16, y: 360 - world.y * 16 - heightMeters * 16 };
}

export function fakeWorld() {
  return { resize: vi.fn(), render: vi.fn(), dispose: vi.fn(), project: vi.fn(legacyProjection),
    pick: vi.fn((pixel: Point) => ({ x: pixel.x / 32, y: -pixel.y / 32 })) };
}
