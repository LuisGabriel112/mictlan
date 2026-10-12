import { expect, test, vi } from 'vitest';
import { FpsMeter } from '../src/fps-meter';

function fakeEnvironment() {
  let pending: ((time: number) => void) | undefined;
  const label = { textContent: '', className: '' };
  const env = {
    document: { createElement: vi.fn(() => label), body: { append: vi.fn() } },
    window: { requestAnimationFrame: vi.fn((callback: (time: number) => void) => { pending = callback; return 1; }) },
  };
  const frame = (time: number) => pending?.(time);
  return { env, label, frame };
}

test('the meter shows average fps and the worst frame of each half second', () => {
  const { env, label, frame } = fakeEnvironment();
  new FpsMeter(env as never).start();
  [0, 20, 40, 100, 120, 500].forEach(frame);
  expect(env.document.body.append).toHaveBeenCalledWith(label);
  expect(label.textContent).toBe('10 fps · peor 380 ms');
});

test('the meter waits for half a second of frames before writing', () => {
  const { label, env, frame } = fakeEnvironment();
  new FpsMeter(env as never).start();
  [0, 16, 32].forEach(frame);
  expect(label.textContent).toBe('');
});
