import { vi } from 'vitest';

export function textMock() {
  const label = { width: 40, height: 20, text: '', visible: true };
  const methods = ['setOrigin', 'setPosition', 'setColor', 'setAlpha', 'setScale', 'setFontSize'];
  const chained = Object.fromEntries(methods.map((method) => [method, vi.fn().mockReturnValue(label)]));
  return Object.assign(label, chained, {
    setText: vi.fn((value: string) => { label.text = value; return label; }),
    setVisible: vi.fn((visible: boolean) => { label.visible = visible; return label; }),
  });
}

export function graphicsMock() {
  const graphics = { clear: vi.fn() };
  const methods = ['lineStyle', 'strokeCircle', 'fillStyle', 'fillCircle', 'fillRect', 'strokeRect', 'lineBetween'];
  return Object.assign(graphics, Object.fromEntries(methods.map((method) => [method, vi.fn().mockReturnValue(graphics)])));
}

function cameraMock() {
  return { zoom: 0.5, ignore: vi.fn(), setSize: vi.fn(), setZoom: vi.fn(), centerOn: vi.fn(),
    getWorldPoint: vi.fn((x: number, y: number) => ({ x, y })) };
}

export function sceneFixture() {
  const labels: ReturnType<typeof textMock>[] = [];
  const graphics: ReturnType<typeof graphicsMock>[] = [];
  const addText = vi.fn(() => { const label = textMock(); labels.push(label); return label; });
  const addGraphics = vi.fn(() => { const drawing = graphicsMock(); graphics.push(drawing); return drawing; });
  const hudCamera = cameraMock();
  return { labels, graphics, hudCamera, add: { text: addText, graphics: addGraphics },
    cameras: { main: cameraMock(), add: vi.fn(() => hudCamera) },
    scale: { width: 1280, height: 720, on: vi.fn() }, time: { now: 0 }, events: { once: vi.fn() },
    input: { mouse: { disableContextMenu: vi.fn() }, on: vi.fn() } };
}
