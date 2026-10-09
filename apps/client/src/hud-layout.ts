import { groupFrameRect, type Rect } from './frames';

export const HUD_LAYOUT = {
  margin: 16, slotWidth: 132, slotHeight: 54, slotGap: 8, flashMs: 1500, maxGroup: 5,
  unitFrame: { width: 260, height: 50 }, castBar: { width: 320, height: 22 },
  clockTop: 96, bossCastTop: 122, logBottomGap: 130, logPadding: 10,
} as const;

export function floatingTextPanels(width: number, height: number, logRect: Rect): Rect[] {
  // Reserve the frame/cast/clock strip and the action/own cast/notice strip.
  return [
    { x: 0, y: 0, width, height: HUD_LAYOUT.bossCastTop + HUD_LAYOUT.castBar.height },
    { x: 0, y: height - HUD_LAYOUT.logBottomGap, width, height: HUD_LAYOUT.logBottomGap },
    ...Array.from({ length: HUD_LAYOUT.maxGroup }, (_, index) => groupFrameRect(index)),
    logRect,
  ];
}
