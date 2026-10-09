import { vi } from 'vitest';

export class HelpElement {
  textContent = '';
  className = '';
  id = '';
  hidden = false;
  open = false;
  style: Record<string, string> = {};
  children: HelpElement[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, (event: unknown) => void>();
  focus = vi.fn();
  remove = vi.fn();
  showModal = vi.fn(() => { this.open = true; });
  close = vi.fn(() => { this.open = false; });
  setAttribute = vi.fn((name: string, value: string) => this.attributes.set(name, value));
  addEventListener = vi.fn((name: string, callback: (event: unknown) => void) => this.listeners.set(name, callback));
  removeEventListener = vi.fn();
  append = vi.fn((...children: HelpElement[]) => this.children.push(...children));
  replaceChildren = vi.fn((...children: HelpElement[]) => { this.children = children; });
}

export function helpDocument() {
  const elements = new Map(['class-panel', 'how-to-play', 'combat-help'].map((id) => [id, new HelpElement()]));
  const created: HelpElement[] = [];
  const document = { activeElement: new HelpElement(), body: new HelpElement(),
    getElementById: vi.fn((id: string) => elements.get(id)),
    createElement: vi.fn(() => { const element = new HelpElement(); created.push(element); return element; }) };
  const window = { innerWidth: 1280, innerHeight: 720, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  return { document, window, created, elements, element: (id: string) => elements.get(id)! };
}

export function descendants(element: HelpElement): HelpElement[] {
  return [element, ...element.children.flatMap(descendants)];
}

export function helpEvent(code = '', repeat = false) {
  return { code, repeat, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
}
