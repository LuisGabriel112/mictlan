import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { BloomRenderer } from '../src/world-3d/bloom-renderer';
import { createBrowserWorld } from '../src/world-3d/browser-world';
import { ThreeArenaWorld } from '../src/world-3d/three-arena';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  const WebGLRenderer = vi.fn(function () {
    return { domElement: { className: '' }, shadowMap: { enabled: false, type: 0 }, setPixelRatio: vi.fn(), setSize: vi.fn(),
      render: vi.fn(), dispose: vi.fn() };
  });
  return { ...actual, WebGLRenderer };
});
vi.mock('../src/world-3d/bloom-renderer', () => ({
  BloomRenderer: vi.fn(function (renderer: { domElement: unknown }) {
    return { domElement: renderer.domElement, setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
  }),
}));

test('the browser world puts a shadowed, tone-mapped Three canvas with bloom under the Phaser HUD', () => {
  const container = { prepend: vi.fn() };
  const world = createBrowserWorld(container as unknown as HTMLElement, 2);
  const renderer = vi.mocked(THREE.WebGLRenderer).mock.results[0].value;
  expect(THREE.WebGLRenderer).toHaveBeenCalledWith({ antialias: true });
  expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
  expect(renderer.shadowMap).toEqual({ enabled: true, type: THREE.PCFSoftShadowMap });
  expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
  expect(renderer.toneMappingExposure).toBeGreaterThan(1);
  expect(renderer.domElement.className).toBe('world-canvas');
  expect(container.prepend).toHaveBeenCalledWith(renderer.domElement);
  expect(BloomRenderer).toHaveBeenCalledWith(renderer);
  expect(world).toBeInstanceOf(ThreeArenaWorld);
});
