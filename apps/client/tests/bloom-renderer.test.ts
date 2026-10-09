import { expect, test, vi } from 'vitest';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BLOOM, BloomRenderer } from '../src/world-3d/bloom-renderer';

vi.mock('three/addons/postprocessing/EffectComposer.js', () => ({
  EffectComposer: vi.fn(function () { return { addPass: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn() }; }),
}));
vi.mock('three/addons/postprocessing/RenderPass.js', () => ({ RenderPass: vi.fn(function () { return { kind: 'scene' }; }) }));
vi.mock('three/addons/postprocessing/OutputPass.js', () => ({ OutputPass: vi.fn(function () { return { kind: 'output' }; }) }));
vi.mock('three/addons/postprocessing/UnrealBloomPass.js', () => ({
  UnrealBloomPass: vi.fn(function () { return { kind: 'bloom', dispose: vi.fn() }; }),
}));

function fixture() {
  const renderer = { domElement: { id: 'canvas' }, setSize: vi.fn(), dispose: vi.fn() };
  const bloom = new BloomRenderer(renderer as unknown as THREE.WebGLRenderer);
  const composer = vi.mocked(EffectComposer).mock.results.at(-1)!.value;
  return { renderer, bloom, composer };
}

test('bloom uses the SPEC glow settings and exposes the real canvas', () => {
  const { renderer, bloom } = fixture();
  expect(UnrealBloomPass).toHaveBeenLastCalledWith(expect.any(THREE.Vector2), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  expect(bloom.domElement).toBe(renderer.domElement);
});

test('the first frame builds scene, bloom and output passes once, then every frame composes', () => {
  const { bloom, composer } = fixture();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera();
  bloom.render(scene, camera);
  bloom.render(scene, camera);
  expect(RenderPass).toHaveBeenCalledExactlyOnceWith(scene, camera);
  expect(OutputPass).toHaveBeenCalledOnce();
  expect(composer.addPass.mock.calls.map(([pass]: [{ kind: string }]) => pass.kind)).toEqual(['scene', 'bloom', 'output']);
  expect(composer.render).toHaveBeenCalledTimes(2);
});

test('resizing and disposing reach the renderer, the composer and the bloom pass', () => {
  const { renderer, bloom, composer } = fixture();
  bloom.setSize(800, 600);
  expect(renderer.setSize).toHaveBeenCalledWith(800, 600);
  expect(composer.setSize).toHaveBeenCalledWith(800, 600);
  bloom.dispose();
  expect(vi.mocked(UnrealBloomPass).mock.results.at(-1)!.value.dispose).toHaveBeenCalledOnce();
  expect(composer.dispose).toHaveBeenCalledOnce();
  expect(renderer.dispose).toHaveBeenCalledOnce();
});
