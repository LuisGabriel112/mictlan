import { expect, test } from 'vitest';
import { TutorialView } from '../src/tutorial-view';
import { descendants, helpDocument, helpEvent } from './help-dom-fixtures';

function fixture() {
  const dom = helpDocument();
  const view = new TutorialView(dom.document as unknown as Document);
  const panel = dom.created.find((element) => element.id === 'tutorial')!;
  return { ...dom, view, panel };
}

test('panel starts hidden and shows counter, text and skip button', () => {
  const f = fixture();
  expect(f.panel.hidden).toBe(true);
  expect(f.document.body.children).toContain(f.panel);
  f.view.render({ counter: 'Paso 2/4', text: 'Camina' });
  expect(f.panel.hidden).toBe(false);
  expect(descendants(f.panel).map((node) => node.textContent)).toEqual(expect.arrayContaining(['Paso 2/4', 'Camina', 'Saltar']));
  f.view.render(undefined);
  expect(f.panel.hidden).toBe(true);
});

test('skip button calls the registered callback', () => {
  const f = fixture();
  let skipped = 0;
  f.view.onSkip(() => { skipped += 1; });
  const button = descendants(f.panel).find((node) => node.textContent === 'Saltar')!;
  button.listeners.get('click')!(helpEvent());
  expect(skipped).toBe(1);
});
