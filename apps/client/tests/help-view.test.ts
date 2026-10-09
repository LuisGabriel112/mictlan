import { expect, test } from 'vitest';
import { HelpView } from '../src/help-view';
import { descendants, helpDocument, helpEvent } from './help-dom-fixtures';

function fixture() {
  const dom = helpDocument();
  const view = new HelpView(dom.document as unknown as Document, dom.window as unknown as Window);
  const key = dom.window.addEventListener.mock.calls.find(([name]) => name === 'keydown')![1] as (event: unknown) => void;
  const resize = dom.window.addEventListener.mock.calls.find(([name]) => name === 'resize')![1] as () => void;
  const dialog = dom.created.find((element) => element.attributes.get('aria-labelledby') === 'role-guide-title')!;
  return { ...dom, view, key, resize, dialog };
}

test('lobby panel changes class before ready, renders all metadata and caches unchanged snapshots', () => {
  const f = fixture();
  f.view.render('lobby', 'healer');
  const text = descendants(f.element('class-panel')).map((node) => node.textContent).join(' ');
  for (const fragment of ['Sanador', 'Vida: 700', 'Maná: 1000', 'Q · Remedio', 'cura', 'Costo: 40 maná', 'Casteo: 1.5 s', 'Recarga: 0 s', 'Alcance: 30 m']) {
    expect(text).toContain(fragment);
  }
  const calls = f.document.createElement.mock.calls.length;
  f.view.render('lobby', 'healer');
  expect(f.document.createElement).toHaveBeenCalledTimes(calls);
  f.view.render('lobby', 'jaguar');
  expect(descendants(f.element('class-panel')).map((node) => node.textContent).join(' ')).toContain('Tanque');
});

test('Cómo jugar opens selected role, closes by button or native cancel, and restores focus', () => {
  const f = fixture();
  f.view.render('lobby', 'eagle');
  f.element('how-to-play').listeners.get('click')!(helpEvent());
  expect(f.dialog.open).toBe(true);
  expect(descendants(f.dialog).map((node) => node.textContent).join(' ')).toContain('cortar el Lamento de los muertos');
  const close = descendants(f.dialog).find((node) => node.textContent === 'Cerrar')!;
  close.listeners.get('click')!(helpEvent());
  expect(f.dialog.open).toBe(false);
  expect(f.document.activeElement.focus).toHaveBeenCalledOnce();
  f.element('how-to-play').listeners.get('click')!(helpEvent());
  const cancel = helpEvent();
  f.dialog.listeners.get('cancel')!(cancel);
  expect(cancel.preventDefault).toHaveBeenCalledOnce();
  expect(f.dialog.open).toBe(false);
});

test('combat hover and focus reveal the corresponding tooltip, leave hides it, resize aligns labels', () => {
  const f = fixture();
  f.view.render('combat', 'jaguar');
  const layer = f.element('combat-help');
  expect(layer.hidden).toBe(false);
  const slots = layer.children;
  expect(slots).toHaveLength(4);
  slots.forEach((slot, index) => {
    expect(slot.style.left).toBe(`${[364, 504, 644, 784][index]}px`);
    expect(slot.style.top).toBe('650px');
    const tooltip = slot.children[1];
    expect(tooltip.hidden).toBe(true);
    slot.listeners.get('pointerenter')!(helpEvent());
    expect(tooltip.hidden).toBe(false);
    slot.listeners.get('pointerleave')!(helpEvent());
    expect(tooltip.hidden).toBe(true);
    slot.listeners.get('focus')!(helpEvent());
    expect(tooltip.hidden).toBe(false);
    slot.listeners.get('blur')!(helpEvent());
    expect(tooltip.hidden).toBe(true);
  });
  expect(descendants(slots[2]).map((node) => node.textContent).join(' ')).toContain('E · Escudo de obsidiana');
  f.window.innerWidth = 1000;
  f.window.innerHeight = 600;
  f.resize();
  expect(layer.children[3].style.left).toBe('644px');
  expect(layer.children[3].style.top).toBe('530px');
});

test('H toggles in combat, Escape closes, repeats do not toggle and modal keys never reach combat', () => {
  const f = fixture();
  f.view.render('combat', 'healer');
  f.key(helpEvent('KeyH', true));
  expect(f.dialog.open).toBe(false);
  f.key(helpEvent('KeyH'));
  expect(f.dialog.open).toBe(true);
  const cast = helpEvent('KeyQ');
  f.key(cast);
  expect(cast.stopImmediatePropagation).toHaveBeenCalledOnce();
  f.key(helpEvent('KeyH', true));
  expect(f.dialog.open).toBe(true);
  const tab = helpEvent('Tab');
  f.key(tab);
  expect(tab.preventDefault).not.toHaveBeenCalled();
  f.key(helpEvent('Escape'));
  expect(f.dialog.open).toBe(false);
  f.key(helpEvent('KeyH'));
  f.key(helpEvent('KeyH'));
  expect(f.dialog.open).toBe(false);
  const normal = helpEvent('KeyQ');
  f.key(normal);
  expect(normal.stopImmediatePropagation).not.toHaveBeenCalled();
});

test('transitions close help, hide combat layer, lobby H does not open, and dispose removes listeners', () => {
  const f = fixture();
  f.view.render('combat', 'eagle');
  f.key(helpEvent('KeyH'));
  f.view.render('result', 'eagle');
  expect(f.dialog.open).toBe(false);
  expect(f.element('combat-help').hidden).toBe(true);
  f.view.render('lobby', 'jaguar');
  f.key(helpEvent('KeyH'));
  expect(f.dialog.open).toBe(false);
  f.resize();
  f.view.dispose();
  expect(f.window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  expect(f.window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(f.dialog.remove).toHaveBeenCalledOnce();
});
