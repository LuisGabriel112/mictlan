import { vi } from 'vitest';
import { HelpElement, descendants } from './help-dom-fixtures';
type Writes = (key: string, value: unknown) => void;

export function hudDocument() {
  const writes = vi.fn<(key: string, value: unknown) => void>();
  const created: HelpElement[] = [];
  const createElement = vi.fn(() => trackedElement(writes, created));
  const host = trackedElement(writes, created);
  const document = { createElement } as unknown as Document;
  const find = (className: string) => descendants(host).filter((node) => (node.className ?? '').split(' ').includes(className));
  return { document, host, created, writes, find, parent: host as unknown as HTMLElement };
}

function trackedElement(writes: Writes, created: HelpElement[]) {
  const element = new HelpElement();
  const style: Record<string, string> = {};
  element.style = new Proxy(style, { set: (target, key: string, value: string) => {
    writes(key, value); target[key] = value; return true;
  } });
  for (const property of ['textContent', 'hidden', 'className']) trackProperty(element, property, writes);
  created.push(element);
  return element;
}

function trackProperty(element: HelpElement, property: string, writes: Writes): void {
  let value: unknown;
  Object.defineProperty(element, property, { get: () => value,
    set: (next: unknown) => { writes(property, next); value = next; }, configurable: true });
}

export function fakeBrowser() {
  const listeners = new Map<string, (event: unknown) => void>();
  const browser = { innerWidth: 1280, innerHeight: 720,
    addEventListener: vi.fn((name: string, callback: (event: unknown) => void) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    requestAnimationFrame: vi.fn<(callback: FrameRequestCallback) => number>().mockReturnValue(7),
    cancelAnimationFrame: vi.fn() };
  return { browser, listeners, window: browser as unknown as Window };
}
