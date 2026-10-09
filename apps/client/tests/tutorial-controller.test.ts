import { expect, test, vi } from 'vitest';
import { TutorialController, browserTutorialStore, type TutorialRoom } from '../src/tutorial-controller';
import { entity, room } from './fixtures';
import type { TutorialPrompt } from '../src/tutorial-steps';
import type { RoomSnapshot } from '../src/snapshot';

const BOSS = entity({ id: 'boss', type: 'boss', classId: '' });

function fixture(finished = false) {
  let onState: (state: { toJSON(): unknown }) => void = () => undefined;
  const roomStub: TutorialRoom = { sessionId: 'me', onStateChange: (callback) => { onState = callback; } };
  const store = { isFinished: vi.fn(() => finished), markFinished: vi.fn() };
  const rendered: (TutorialPrompt | undefined)[] = [];
  let skip = () => undefined as void;
  const view = { render: vi.fn((prompt?: TutorialPrompt) => { rendered.push(prompt); }),
    onSkip: vi.fn((callback: () => void) => { skip = callback; }) };
  const keys = { addEventListener: vi.fn() };
  new TutorialController(roomStub, store, view, keys);
  const key = keys.addEventListener.mock.calls[0][1] as (event: { code: string; repeat: boolean }) => void;
  const send = (snapshot: unknown) => onState({ toJSON: () => snapshot });
  return { store, rendered, send, key, skip: () => skip() };
}

function combat(self = {}, overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return room([BOSS, entity({ id: 'me', classId: 'eagle', ...self })], overrides);
}

test('shows step 1 in combat only and ignores incomplete snapshots', () => {
  const f = fixture();
  f.send({ status: 'combat' });
  expect(f.rendered).toEqual([]);
  f.send(combat({}, { status: 'lobby' }));
  f.send(combat());
  expect(f.rendered).toEqual([undefined, { counter: 'Paso 1/4', text: expect.stringContaining('jefe') }]);
});

test('finishing the last step saves completion and hides the panel', () => {
  const f = fixture();
  f.send(combat({ targetId: 'boss' }));
  f.send(combat({ x: 0 }));
  f.send(combat({ x: 2 }));
  f.send(combat({ gcdRemainingTicks: 3 }));
  const zones = { z: { id: 'z', x: 0, y: 0, radiusMeters: 3, remainingTicks: 5 } };
  f.send(combat({}, { zones }));
  f.send(combat({ x: 9 }, { zones }));
  expect(f.store.markFinished).toHaveBeenCalledOnce();
  expect(f.rendered.at(-1)).toBeUndefined();
});

test('skip hides and saves; T restarts on step 1', () => {
  const f = fixture();
  f.send(combat({ targetId: 'boss' }));
  f.skip();
  expect(f.store.markFinished).toHaveBeenCalledOnce();
  expect(f.rendered.at(-1)).toBeUndefined();
  f.send(combat());
  expect(f.rendered.at(-1)).toBeUndefined();
  f.key({ code: 'KeyT', repeat: false });
  f.send(combat());
  expect(f.rendered.at(-1)).toMatchObject({ counter: 'Paso 1/4' });
});

test('already finished browser starts hidden; repeated or other keys do nothing', () => {
  const f = fixture(true);
  f.key({ code: 'KeyT', repeat: true });
  f.key({ code: 'KeyH', repeat: false });
  f.send(combat());
  expect(f.rendered).toEqual([undefined]);
});

test('browser store reads and writes the flag and survives storage errors', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  const store = browserTutorialStore(() => storage);
  expect(store.isFinished()).toBe(false);
  store.markFinished();
  expect(store.isFinished()).toBe(true);
  const broken = browserTutorialStore(() => { throw new Error('blocked'); });
  expect(broken.isFinished()).toBe(false);
  expect(() => broken.markFinished()).not.toThrow();
});
