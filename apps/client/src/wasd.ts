import type { Point } from './snapshot';
import { isoCamera } from './world-3d/iso-camera';

// SPEC §11: WASD walks relative to the fixed iso camera, so W is always "up the screen".
const MOVE_KEYS: Readonly<Record<string, { screenX: number; screenY: number }>> = {
  KeyW: { screenX: 0, screenY: 1 }, KeyS: { screenX: 0, screenY: -1 },
  KeyA: { screenX: -1, screenY: 0 }, KeyD: { screenX: 1, screenY: 0 },
};
const STILL: Point = { x: 0, y: 0 };

function groundAxes(): { right: Point; up: Point } {
  const { right, forward } = isoCamera(1, 1);
  const length = Math.hypot(forward.x, forward.z);
  // Three z is core south, so core y = -z.
  return { right: { x: right.x, y: -right.z }, up: { x: forward.x / length, y: -forward.z / length } };
}

const AXES = groundAxes();

export function heldDirection(held: ReadonlySet<string>): Point {
  let screenX = 0;
  let screenY = 0;
  for (const code of held) {
    screenX += MOVE_KEYS[code]?.screenX ?? 0;
    screenY += MOVE_KEYS[code]?.screenY ?? 0;
  }
  const x = AXES.right.x * screenX + AXES.up.x * screenY;
  const y = AXES.right.y * screenX + AXES.up.y * screenY;
  const length = Math.hypot(x, y);
  return length === 0 ? STILL : { x: x / length, y: y / length };
}

export class WasdWalker {
  private readonly held = new Set<string>();
  private sent: Point = STILL;

  constructor(private readonly send: (direction: Point) => void) {}

  get moving(): boolean {
    return this.sent !== STILL;
  }

  keyDown(code: string): boolean {
    if (!(code in MOVE_KEYS)) return false;
    this.held.add(code);
    this.sync();
    return true;
  }

  keyUp(code: string): boolean {
    if (!this.held.delete(code)) return false;
    this.sync();
    return true;
  }

  // Window blur: the keyup never arrives, so stop instead of walking forever.
  release(): void {
    this.held.clear();
    this.sync();
  }

  reset(): void {
    this.held.clear();
    this.sent = STILL;
  }

  private sync(): void {
    const direction = heldDirection(this.held);
    if (direction.x === this.sent.x && direction.y === this.sent.y) return;
    this.sent = direction;
    this.send(direction);
  }
}
