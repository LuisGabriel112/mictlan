export interface HeldKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export const NO_KEYS_HELD: HeldKeys = { up: false, down: false, left: false, right: false };

const MOVE_KEYS: Readonly<Record<string, keyof HeldKeys>> = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

export function applyMoveKey(keys: HeldKeys, code: string, pressed: boolean): HeldKeys {
  const direction = Object.hasOwn(MOVE_KEYS, code) ? MOVE_KEYS[code] : undefined;
  return direction ? { ...keys, [direction]: pressed } : keys;
}

export interface MoveVector {
  dx: number;
  dy: number;
}

export function moveVector(keys: HeldKeys): MoveVector {
  const dx = Number(keys.right) - Number(keys.left);
  const dy = Number(keys.up) - Number(keys.down);
  const length = Math.hypot(dx, dy);
  return length === 0 ? { dx: 0, dy: 0 } : { dx: dx / length, dy: dy / length };
}

// The server holds the last move until it changes (SPEC §7), so only changes are sent.
export class MoveSender {
  private last: MoveVector = { dx: 0, dy: 0 };

  update(next: MoveVector): MoveVector | undefined {
    if (next.dx === this.last.dx && next.dy === this.last.dy) return undefined;
    this.last = next;
    return next;
  }
}
