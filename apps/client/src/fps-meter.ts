const WINDOW_MS = 500;

interface MeterEnvironment {
  document: Pick<Document, 'createElement' | 'body'>;
  window: Pick<Window, 'requestAnimationFrame'>;
}

// ?fps=1: lets Venegas measure frame rate on his machine instead of guessing.
export class FpsMeter {
  private readonly label: HTMLElement;
  private windowStart?: number;
  private last?: number;
  private frames = 0;
  private worst = 0;

  constructor(private readonly env: MeterEnvironment) {
    this.label = env.document.createElement('div');
    this.label.className = 'fps-meter';
  }

  start(): void {
    this.env.document.body.append(this.label);
    this.env.window.requestAnimationFrame((time) => this.frame(time));
  }

  private frame(time: number): void {
    if (this.last !== undefined) this.record(time);
    this.windowStart ??= time;
    this.last = time;
    this.env.window.requestAnimationFrame((next) => this.frame(next));
  }

  private record(time: number): void {
    this.frames += 1;
    this.worst = Math.max(this.worst, time - (this.last ?? time));
    const elapsed = time - (this.windowStart ?? time);
    if (elapsed < WINDOW_MS) return;
    this.label.textContent = `${Math.round((this.frames * 1000) / elapsed)} fps · peor ${Math.round(this.worst)} ms`;
    this.windowStart = time;
    this.frames = 0;
    this.worst = 0;
  }
}
