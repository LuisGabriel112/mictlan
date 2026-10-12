export interface RenderQuality {
  bloom: boolean;
  shadows: boolean;
  maxPixelRatio: number;
  showFps: boolean;
}

// Venegas saw low fps; fx=low lets slow machines trade the glow and shadows for frame rate.
export function parseRenderQuality(search: string): RenderQuality {
  const params = new URLSearchParams(search);
  const low = params.get('fx') === 'low';
  return { bloom: !low, shadows: !low, maxPixelRatio: low ? 1 : 1.5, showFps: params.get('fps') === '1' };
}
