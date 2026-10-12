import { expect, test } from 'vitest';
import { parseRenderQuality } from '../src/world-3d/render-quality';

test('high quality is the default: bloom, shadows and a 1.5 pixel-ratio cap', () => {
  expect(parseRenderQuality('')).toEqual({ bloom: true, shadows: true, maxPixelRatio: 1.5, showFps: false });
});

test('fx=low drops bloom and shadows and renders at pixel ratio 1', () => {
  expect(parseRenderQuality('?fx=low')).toEqual({ bloom: false, shadows: false, maxPixelRatio: 1, showFps: false });
});

test('fps=1 shows the meter without changing quality', () => {
  expect(parseRenderQuality('?dev=1&fps=1')).toMatchObject({ bloom: true, showFps: true });
});

test('unknown fx values keep high quality', () => {
  expect(parseRenderQuality('?fx=ultra').bloom).toBe(true);
});
