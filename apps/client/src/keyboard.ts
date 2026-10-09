export type KeyAction =
  | { type: 'cycleEnemy' }
  | { type: 'ally'; index: number }
  | { type: 'cast'; slot: number }
  | { type: 'stop' };

export interface KeyResult {
  action: KeyAction | null;
  preventDefault: boolean;
}

// SPEC §11: WASD walks, so abilities moved to 1–4 (row or numpad), in action bar order.
export const ABILITY_KEYS = ['1', '2', '3', '4'] as const;
const NO_ACTION: KeyResult = { action: null, preventDefault: false };

// Tab and F1–F5 would move focus or reload the page, so the client must block them (SPEC §5).
function blocked(action: KeyAction): KeyResult {
  return { action, preventDefault: true };
}

function abilitySlot(code: string): number {
  return ABILITY_KEYS.findIndex((key) => code === `Digit${key}` || code === `Numpad${key}`) + 1;
}

export function keyAction({ code, shiftKey }: { code: string; shiftKey: boolean }): KeyResult {
  if (code === 'Tab') return blocked({ type: 'cycleEnemy' });
  if (code === 'KeyX') return { action: { type: 'stop' }, preventDefault: false };
  const functionKey = /^F([1-5])$/.exec(code);
  if (functionKey) return blocked({ type: 'ally', index: Number(functionKey[1]) });
  const digit = shiftKey ? /^(?:Digit|Numpad)([1-5])$/.exec(code) : null;
  if (digit) return blocked({ type: 'ally', index: Number(digit[1]) });
  const slot = abilitySlot(code);
  return slot > 0 ? { action: { type: 'cast', slot }, preventDefault: false } : NO_ACTION;
}
