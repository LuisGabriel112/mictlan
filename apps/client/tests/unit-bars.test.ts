import type * as Phaser from 'phaser';
import { expect, test, vi } from 'vitest';
import { drawUnitBars } from '../src/scene/unit-bars';
import { UNIT_HEIGHTS } from '../src/world-3d/arena-world';
import { entity, room } from './fixtures';
import { graphicsMock } from './phaser-fixtures';

function draw(entities: Parameters<typeof room>[0], positions = {}) {
  const graphics = graphicsMock();
  const project = vi.fn((world: { x: number; y: number }, height = 0) => ({ x: world.x * 10, y: 500 - height * 10 }));
  drawUnitBars(graphics as unknown as Phaser.GameObjects.Graphics, room(entities), positions, project);
  return { graphics, project };
}

test('each living unit gets a back and a fill bar above its head at the interpolated position', () => {
  const { graphics, project } = draw([entity({ id: 'p', health: 25, maxHealth: 100, x: 9 })], { p: { x: 2, y: 0 } });
  expect(project).toHaveBeenCalledWith({ x: 2, y: 0 }, UNIT_HEIGHTS.player + 0.5);
  expect(graphics.fillStyle.mock.calls).toEqual([[0x222222, 1], [0x4cd964, 1]]);
  const top = 500 - (UNIT_HEIGHTS.player + 0.5) * 10 - 4;
  expect(graphics.fillRect.mock.calls).toEqual([[20 - 16, top, 32, 4], [20 - 16, top, 8, 4]]);
});

test('big units get wider bars and dead units get none', () => {
  const { graphics } = draw([entity({ id: 'boss', type: 'boss', classId: '' }), entity({ id: 'dead', health: 0 })]);
  expect(graphics.fillRect).toHaveBeenCalledTimes(2);
  expect(graphics.fillRect.mock.calls[0][2]).toBeGreaterThan(32);
});

test('overhealed health is clamped to the bar', () => {
  const { graphics } = draw([entity({ id: 'p', health: 150, maxHealth: 100 })]);
  expect(graphics.fillRect.mock.calls[1][2]).toBe(32);
});
