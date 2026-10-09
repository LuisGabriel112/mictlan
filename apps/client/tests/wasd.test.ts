import { describe, expect, test, vi } from 'vitest';
import { isoCamera, projectToScreen } from '../src/world-3d/iso-camera';
import { WasdWalker, heldDirection } from '../src/wasd';

const HALF = Math.SQRT1_2;

function close(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
}

describe('heldDirection', () => {
  test.each([
    [['KeyW'], { x: -HALF, y: HALF }], [['KeyD'], { x: HALF, y: HALF }],
    [['KeyS'], { x: HALF, y: -HALF }], [['KeyA'], { x: -HALF, y: -HALF }],
    [['KeyW', 'KeyD'], { x: 0, y: 1 }], [['KeyW', 'KeyS'], { x: 0, y: 0 }], [[], { x: 0, y: 0 }],
  ])('%j walks camera-relative to %j', (codes, expected) => {
    close(heldDirection(new Set(codes)), expected);
  });

  test('W walks straight up the screen and D straight right', () => {
    const camera = isoCamera(1280, 720);
    const center = projectToScreen(camera, { x: 0, y: 0 });
    const up = projectToScreen(camera, heldDirection(new Set(['KeyW'])));
    const right = projectToScreen(camera, heldDirection(new Set(['KeyD'])));
    expect(up.x).toBeCloseTo(center.x, 6);
    expect(up.y).toBeLessThan(center.y);
    expect(right.y).toBeCloseTo(center.y, 6);
    expect(right.x).toBeGreaterThan(center.x);
  });

  test('diagonals keep unit speed', () => {
    const { x, y } = heldDirection(new Set(['KeyS', 'KeyA']));
    expect(Math.hypot(x, y)).toBeCloseTo(1, 6);
  });
});

describe('WasdWalker', () => {
  function walker() {
    const send = vi.fn();
    return { send, walk: new WasdWalker(send) };
  }

  test('only movement keys are claimed and only direction changes are sent', () => {
    const { send, walk } = walker();
    expect(walk.keyDown('KeyQ')).toBe(false);
    expect(walk.keyDown('KeyW')).toBe(true);
    expect(walk.keyDown('KeyW')).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    close(send.mock.calls[0][0], { x: -HALF, y: HALF });
    walk.keyDown('KeyD');
    close(send.mock.calls[1][0], { x: 0, y: 1 });
  });

  test('releasing every key or cancelling opposites stops the walk', () => {
    const { send, walk } = walker();
    walk.keyDown('KeyA');
    walk.keyDown('KeyD');
    expect(send.mock.calls.at(-1)![0]).toEqual({ x: 0, y: 0 });
    walk.keyUp('KeyD');
    walk.keyUp('KeyA');
    expect(send.mock.calls.at(-1)![0]).toEqual({ x: 0, y: 0 });
    expect(walk.keyUp('KeyQ')).toBe(false);
    expect(walk.moving).toBe(false);
  });

  test('losing focus stops a walk once; reset forgets keys silently', () => {
    const { send, walk } = walker();
    walk.release();
    expect(send).not.toHaveBeenCalled();
    walk.keyDown('KeyD');
    walk.release();
    expect(send.mock.calls.at(-1)![0]).toEqual({ x: 0, y: 0 });
    walk.keyDown('KeyS');
    send.mockClear();
    walk.reset();
    expect(send).not.toHaveBeenCalled();
    expect(walk.moving).toBe(false);
    walk.keyDown('KeyS');
    expect(send).toHaveBeenCalledOnce();
  });
});
