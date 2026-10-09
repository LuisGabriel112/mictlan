import type * as Phaser from 'phaser';
import { expect, test } from 'vitest';
import { recordHitFlashes } from '../src/hit-flash';
import { drawEntities } from '../src/scene/arena-renderer';
import { bossRoom, hit } from './hit-flash-fixtures';
import { graphicsMock } from './phaser-fixtures';

test.each([[false, 0xffffff, 1.03], [true, 0xffe066, 1.05]])(
  'only the boss gets the %s overlay at its interpolated position', (critical, color, scale) => {
    const graphics = graphicsMock();
    const hits = recordHitFlashes(new Map(), [hit('boss', critical), hit('eagle'), hit('xolo')], 1000);
    drawEntities(graphics as unknown as Phaser.GameObjects.Graphics, bossRoom(),
      { boss: { x: 4, y: 5 } }, 'eagle', { hits, nowMs: critical ? 1140 : 1100 });
    expect(graphics.fillStyle).toHaveBeenCalledWith(color, 0.5);
    expect(graphics.fillCircle.mock.calls).toEqual([[320, -0, 16], [128, -160, 48],
      [128, -160, 48 * scale], [-320, -0, 16]]);
    const overlayOrder = graphics.fillCircle.mock.invocationCallOrder[2];
    expect(graphics.strokeCircle.mock.invocationCallOrder[1]).toBeGreaterThan(overlayOrder);
    expect(graphics.fillRect.mock.invocationCallOrder[2]).toBeGreaterThan(overlayOrder);
    expect(graphics.strokeCircle).toHaveBeenCalledWith(128, -160, 55);
    expect(graphics.fillRect).toHaveBeenCalledWith(80, -214, 96, 4);
  },
);

test.each([undefined, { hits: new Map(), nowMs: 0 },
  { hits: recordHitFlashes(new Map(), [hit()], 0), nowMs: 200 }])(
  'missing or expired flashes draw only the original entity circles', (frame) => {
    const graphics = graphicsMock();
    drawEntities(graphics as unknown as Phaser.GameObjects.Graphics, bossRoom(), {}, 'absent', frame);
    expect(graphics.fillCircle).toHaveBeenCalledTimes(3);
  },
);
