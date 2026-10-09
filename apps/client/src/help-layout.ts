import type { ClassDefinition } from '@mictlan/core';
import { classHelp } from './ability-help';
import { actionSlotRects } from './reading-layout';

export function helpSlots(definition: ClassDefinition, width: number, height: number) {
  const rectangles = actionSlotRects(width, height);
  return classHelp(definition).abilities.map((help, index) => ({ help, rect: rectangles[index] }));
}

export function guideKey(open: boolean, event: { code: string; repeat: boolean }): 'open' | 'close' | 'none' {
  if (event.repeat) return 'none';
  if (event.code === 'KeyH') return open ? 'close' : 'open';
  return open && event.code === 'Escape' ? 'close' : 'none';
}
