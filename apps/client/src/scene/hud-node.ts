import type { Rect } from '../frames';

export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// One DOM element whose writes are skipped when the value did not change, so a 60 fps HUD avoids reflow.
export class HudNode {
  readonly element: HTMLElement;
  private readonly written = new Map<string, string | boolean>();

  constructor(document: Document, parent: HTMLElement, className: string, tag = 'div') {
    this.element = document.createElement(tag);
    this.element.className = className;
    parent.append(this.element);
  }

  text(value: string): this {
    if (this.changed('text', value)) this.element.textContent = value;
    return this;
  }

  visible(shown: boolean): this {
    if (this.changed('hidden', !shown)) this.element.hidden = !shown;
    return this;
  }

  style(property: string, value: string): this {
    if (this.changed(`style:${property}`, value)) (this.element.style as unknown as Record<string, string>)[property] = value;
    return this;
  }

  attribute(name: string, value: string): this {
    if (this.changed(`attribute:${name}`, value)) this.element.setAttribute(name, value);
    return this;
  }

  place({ x, y, width, height }: Rect): this {
    return this.style('transform', `translate(${x}px, ${y}px)`).style('width', `${width}px`).style('height', `${height}px`);
  }

  fill(ratio: number): this {
    return this.style('transform', `scaleX(${Math.min(1, Math.max(0, ratio))})`);
  }

  remove(): void {
    this.element.remove();
  }

  private changed(key: string, value: string | boolean): boolean {
    if (this.written.get(key) === value) return false;
    this.written.set(key, value);
    return true;
  }
}
