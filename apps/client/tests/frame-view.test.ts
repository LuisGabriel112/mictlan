import { expect, test } from 'vitest';
import { CastBarWidget, FrameWidget } from '../src/scene/frame-view';
import { selfFrame } from '../src/frames';
import { entity, room } from './fixtures';
import { hudDocument } from './hud-dom-fixtures';

const rect = { x: 16, y: 16, width: 260, height: 50 };

test('frames show name, health, resource, class color and self border without repeated writes', () => {
  const fixture = hudDocument();
  const widget = new FrameWidget(fixture.document, fixture.parent);
  const frame = selfFrame(room([entity({ id: 'h', classId: 'healer', health: 25, maxHealth: 100, mana: 40, maxMana: 100 })]), 'h');
  widget.draw(frame, rect);
  expect(fixture.find('hud-frame-name')[0].textContent).toContain('Tícitl');
  expect(fixture.find('hud-frame-health')[0].textContent).toBe('25/100');
  expect(fixture.find('hud-health-fill')[0].style).toMatchObject({ transform: 'scaleX(0.25)', backgroundColor: '#e5484d' });
  expect(fixture.find('hud-mana-fill')[0].style.transform).toBe('scaleX(0.4)');
  expect(fixture.find('hud-frame')[0].style.borderColor).toBe('#ffffff');
  fixture.writes.mockClear(); widget.draw(frame, rect);
  expect(fixture.writes).not.toHaveBeenCalled();
});

test('frames hide absent units, mark dead units and hide mana when absent', () => {
  const fixture = hudDocument();
  const widget = new FrameWidget(fixture.document, fixture.parent);
  widget.draw(selfFrame(room([entity({ id: 'p', health: 0 })]), 'p'), rect);
  expect(fixture.find('hud-frame-health')[0].textContent).toBe('Muerto');
  expect(fixture.find('hud-frame')[0].style.opacity).toBe('0.5');
  expect(fixture.find('hud-mana-track')[0].hidden).toBe(true);
  widget.draw(undefined, rect);
  expect(fixture.find('hud-frame')[0].hidden).toBe(true);
});

test('cast bars show progress, remaining time and interruptibility, and hide absent casts', () => {
  const fixture = hudDocument();
  const widget = new CastBarWidget(fixture.document, fixture.parent);
  const cast = { abilityName: 'Lamento', progress: 0.25, remainingSeconds: 2.25, interruptible: true };
  widget.draw(cast, rect);
  expect(fixture.find('hud-cast-label')[0].textContent).toBe('Lamento · 2.3 s');
  expect(fixture.find('hud-cast-fill')[0].style.transform).toBe('scaleX(0.25)');
  expect(fixture.find('hud-cast')[0].style).toMatchObject({ borderColor: '#2ec4b6', borderWidth: '3px' });
  widget.draw({ ...cast, interruptible: false }, rect);
  expect(fixture.find('hud-cast')[0].style).toMatchObject({ borderColor: '#888888', borderWidth: '1px' });
  widget.draw(undefined, rect);
  expect(fixture.find('hud-cast')[0].hidden).toBe(true);
});
