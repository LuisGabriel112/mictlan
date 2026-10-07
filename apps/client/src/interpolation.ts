import type { Point } from './snapshot';

export type Positions = Record<string, Point>;

interface PositionFrame {
  timeMs: number;
  positions: Positions;
}

function blend(from: Positions, to: Positions, ratio: number): Positions {
  const blended: Positions = {};
  for (const [id, end] of Object.entries(to)) {
    const start = from[id] ?? end;
    blended[id] = { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio };
  }
  return blended;
}

export class PositionHistory {
  static readonly capacity = 32;
  private readonly frames: PositionFrame[] = [];

  get size(): number {
    return this.frames.length;
  }

  record(timeMs: number, positions: Positions): void {
    this.frames.push({ timeMs, positions });
    if (this.frames.length > PositionHistory.capacity) this.frames.shift();
  }

  sample(renderTimeMs: number): Positions {
    const laterIndex = this.frames.findIndex(({ timeMs }) => timeMs >= renderTimeMs);
    if (laterIndex === -1) return this.frames.at(-1)?.positions ?? {};
    if (laterIndex === 0) return this.frames[0].positions;
    const before = this.frames[laterIndex - 1];
    const after = this.frames[laterIndex];
    return blend(before.positions, after.positions, (renderTimeMs - before.timeMs) / (after.timeMs - before.timeMs));
  }
}
