export type KeyAction =
  | { type: 'cycleEnemy' }
  | { type: 'ally'; index: number }
  | { type: 'cast'; slot: number }
  | { type: 'stop' };

export interface KeyResult {
  action: KeyAction | null;
  preventDefault: boolean;
}

// LoL-style ability keys, in action bar order (slot 1 to 4).
export const ABILITY_KEYS = ['Q', 'W', 'E', 'R'] as const;
const NO_ACTION: KeyResult = { action: null, preventDefault: false };

// Tab and F1–F5 would move focus or reload the page, so the client must block them (SPEC §5).
function blocked(action: KeyAction): KeyResult {
  return { action, preventDefault: true };
}

function abilitySlot(code: string): number {
  return ABILITY_KEYS.findIndex((key) => code === `Key${key}`) + 1;
}

export function keyAction({ code, shiftKey }: { code: string; shiftKey: boolean }): KeyResult {
  if (code === 'Tab') return blocked({ type: 'cycleEnemy' });
  // LoL convention: S stops the click-to-move walk.
  if (code === 'KeyS') return { action: { type: 'stop' }, preventDefault: false };
  const slot = abilitySlot(code);
  if (slot > 0) return { action: { type: 'cast', slot }, preventDefault: false };
  const functionKey = /^F([1-5])$/.exec(code);
  if (functionKey) return blocked({ type: 'ally', index: Number(functionKey[1]) });
  const digit = shiftKey ? /^(?:Digit|Numpad)([1-5])$/.exec(code) : null;
  return digit ? blocked({ type: 'ally', index: Number(digit[1]) }) : NO_ACTION;
}
