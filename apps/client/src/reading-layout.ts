import { groupFrameRect, type Rect } from './frames';
import type { Point } from './snapshot';

export const HUD_LAYOUT = {
  margin: 16, slotWidth: 132, slotHeight: 54, slotGap: 8, flashMs: 1500, maxGroup: 5,
  unitFrame: { width: 260, height: 50 }, castBar: { width: 320, height: 22 },
} as const;
// project maps world meters to screen pixels; T5.1 injects the 3D camera projection here.
export interface ReadingViewport { width: number; height: number; project(world: Point): Point }

export function actionSlotRects(width: number, height: number): Rect[] {
  const { slotWidth, slotGap, slotHeight, margin } = HUD_LAYOUT;
  const totalWidth = 4 * slotWidth + 3 * slotGap;
  return Array.from({ length: 4 }, (_, index) => ({
    x: (width - totalWidth) / 2 + index * (slotWidth + slotGap),
    y: height - slotHeight - margin, width: slotWidth, height: slotHeight,
  }));
}

export function unitFrameRects(): readonly [Rect, Rect, Rect] {
  const { margin, unitFrame } = HUD_LAYOUT;
  return [{ x: margin, y: margin, ...unitFrame }, { x: 2 * margin + unitFrame.width, y: margin, ...unitFrame },
    { x: 2 * margin + unitFrame.width, y: margin + unitFrame.height + 4, width: unitFrame.width, height: 18 }];
}

function actionRects(width: number, height: number): Rect[] {
  const { slotHeight, margin, castBar, slotWidth, slotGap } = HUD_LAYOUT;
  const top = height - slotHeight - margin;
  const actionWidth = 4 * slotWidth + 3 * slotGap;
  return [{ x: (width - actionWidth) / 2, y: top, width: actionWidth, height: slotHeight },
    { x: (width - castBar.width) / 2, y: top - castBar.height - 10, ...castBar },
    { x: (width - 600) / 2, y: top - 66, width: 600, height: 22 }];
}

export function readingLayout(width: number, height: number) {
  const logWidth = Math.min(400, width - 2 * HUD_LAYOUT.margin);
  const log = { x: width - logWidth - HUD_LAYOUT.margin, y: height - 120 - 252, width: logWidth, height: 252 };
  const header = { x: (width - HUD_LAYOUT.castBar.width) / 2, y: 96, ...HUD_LAYOUT.castBar };
  const bossCast = { ...header, y: 126 };
  const groupRects = Array.from({ length: HUD_LAYOUT.maxGroup }, (_, index) => groupFrameRect(index));
  return { log, header, bossCast, protectedRects: [...unitFrameRects(), ...groupRects, ...actionRects(width, height), log, header, bossCast] };
}

export function projectFloatingText(position: Point, viewport: ReadingViewport): Point {
  return viewport.project(position);
}

function overlaps(first: Rect, second: Rect): boolean {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

export function floatingTextVisible(bounds: Rect, viewport: Pick<ReadingViewport, 'width' | 'height'>, obstacles: readonly Rect[]): boolean {
  const inViewport = bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width
    && bounds.y + bounds.height <= viewport.height;
  return inViewport && !obstacles.some((rect) => overlaps(bounds, rect));
}
