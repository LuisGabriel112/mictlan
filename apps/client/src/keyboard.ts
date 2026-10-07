export type KeyAction =
  | { type: 'cycleEnemy' }
  | { type: 'ally'; index: number }
  | { type: 'cast'; slot: number };

export interface KeyResult {
  action: KeyAction | null;
  preventDefault: boolean;
}

const ACTION_SLOTS = 4;
const NO_ACTION: KeyResult = { action: null, preventDefault: false };

// Tab and F1–F5 would move focus or reload the page, so the client must block them (SPEC §5).
function blocked(action: KeyAction): KeyResult {
  return { action, preventDefault: true };
}

export function keyAction({ code, shiftKey }: { code: string; shiftKey: boolean }): KeyResult {
  if (code === 'Tab') return blocked({ type: 'cycleEnemy' });
  const functionKey = /^F([1-5])$/.exec(code);
  if (functionKey) return blocked({ type: 'ally', index: Number(functionKey[1]) });
  const digit = /^(?:Digit|Numpad)([1-5])$/.exec(code);
  if (!digit) return NO_ACTION;
  const index = Number(digit[1]);
  if (shiftKey) return blocked({ type: 'ally', index });
  return index <= ACTION_SLOTS ? { action: { type: 'cast', slot: index }, preventDefault: false } : NO_ACTION;
}
