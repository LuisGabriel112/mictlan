import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { createBrowserWorld } from '../src/world-3d/browser-world';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  const WebGLRenderer = vi.fn(function () {
    return { domElement: { className: '' }, setPixelRatio: vi.fn(), setClearColor: vi.fn(), setSize: vi.fn(),
      render: vi.fn(), dispose: vi.fn() };
  });
  return { ...actual, WebGLRenderer };
});

test('the browser world puts an antialiased Three canvas under the Phaser HUD', () => {
  const container = { prepend: vi.fn() };
  const world = createBrowserWorld(container as unknown as HTMLElement, 2);
  const renderer = vi.mocked(THREE.WebGLRenderer).mock.results[0].value;
  expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: true });
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
  expect(renderer.setClearColor).toHaveBeenCalledWith(0x14101c);
  expect(renderer.domElement.className).toBe('world-canvas');
  expect(container.prepend).toHaveBeenCalledWith(renderer.domElement);
  expect(world).toBeInstanceOf(ThreeArenaWorld);
});
