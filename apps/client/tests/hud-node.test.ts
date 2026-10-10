import { expect, test } from 'vitest';
import { HudNode, hexColor } from '../src/scene/hud-node';
import { hudDocument } from './hud-dom-fixtures';

test('HUD nodes attach once and cache text, visibility, attributes and normalized styles', () => {
  const fixture = hudDocument();
  const node = new HudNode(fixture.document, fixture.parent, 'sample', 'span');
  node.text('Vida'); node.visible(false); node.style('color', '#ffffff'); node.attribute('role', 'status');
  fixture.writes.mockClear();
  node.text('Vida'); node.visible(false); node.style('color', '#ffffff'); node.attribute('role', 'status');
  expect(fixture.writes).not.toHaveBeenCalled();
  expect(fixture.host.children).toHaveLength(1);
  expect(fixture.host.children[0].setAttribute).toHaveBeenCalledExactlyOnceWith('role', 'status');
  expect(fixture.host.children[0].textContent).toBe('Vida');
  expect(fixture.host.children[0].hidden).toBe(true);
  node.visible(true); node.text('Maná');
  expect(fixture.host.children[0].hidden).toBe(false);
  expect(fixture.host.children[0].textContent).toBe('Maná');
});

test('place uses transforms with cached dimensions and fills clamp to their track', () => {
  const fixture = hudDocument();
  const node = new HudNode(fixture.document, fixture.parent, 'sample');
  node.place({ x: 10, y: 20, width: 30, height: 40 });
  expect(fixture.host.children[0].style).toMatchObject({ transform: 'translate(10px, 20px)', width: '30px', height: '40px' });
  node.fill(2); expect(fixture.host.children[0].style.transform).toBe('scaleX(1)');
  node.fill(-1); expect(fixture.host.children[0].style.transform).toBe('scaleX(0)');
  node.fill(0.25); expect(fixture.host.children[0].style.transform).toBe('scaleX(0.25)');
  expect(hexColor(255)).toBe('#0000ff');
  expect(hexColor(0xffffff)).toBe('#ffffff');
});
