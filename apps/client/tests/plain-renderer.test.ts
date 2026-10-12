import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { PlainRenderer } from '../src/world-3d/plain-renderer';

function fakeRenderer() {
  return { domElement: {}, setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() };
}

test('the plain renderer draws the scene straight to the canvas without post-processing', () => {
  const renderer = fakeRenderer();
  const plain = new PlainRenderer(renderer as unknown as THREE.WebGLRenderer);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  plain.setSize(800, 600);
  plain.render(scene, camera);
  plain.dispose();
  expect(plain.domElement).toBe(renderer.domElement);
  expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
  expect(renderer.render).toHaveBeenCalledWith(scene, camera);
  expect(renderer.dispose).toHaveBeenCalled();
});
