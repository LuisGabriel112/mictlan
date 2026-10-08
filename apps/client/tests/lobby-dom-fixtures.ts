import { vi } from 'vitest';

export function domElement() {
  return { textContent: '', value: '', hidden: false, disabled: false, inert: false,
    setAttribute: vi.fn(), replaceChildren: vi.fn(), addEventListener: vi.fn() };
}

export function lobbyDocument() {
  const ids = ['game', 'overlay', 'start-screen', 'lobby-screen', 'result-screen', 'create-room', 'join-room',
    'join-form', 'room-code', 'shared-code', 'players', 'missing-roles', 'capacity', 'ready',
    'class-jaguar', 'class-healer', 'class-eagle', 'result-title', 'result-duration', 'error', 'connection-status'];
  const elements = new Map(ids.map((id) => [id, domElement()]));
  const document = { getElementById: vi.fn((id: string) => elements.get(id)), createElement: vi.fn(() => domElement()) };
  const element = (id: string) => elements.get(id)!;
  return { document: document as unknown as Document, element, elements };
}

export function domListener(element: ReturnType<typeof domElement>, name: string): (event: Event) => unknown {
  return element.addEventListener.mock.calls.find(([type]) => type === name)![1] as (event: Event) => unknown;
}
