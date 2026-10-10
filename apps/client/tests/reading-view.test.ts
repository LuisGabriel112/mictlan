import { expect, test } from 'vitest';
import { CombatReadingView } from '../src/scene/combat-reading-view';
import { room, entity } from './fixtures';
import { legacyProjection } from './world-fixtures';
import { hudDocument } from './hud-dom-fixtures';

const viewport = { width: 1280, height: 720, project: legacyProjection };
const snapshot = room([entity({ id: 'h', classId: 'healer' })]);
const damage = { type: 'damage', sourceId: 'boss', targetId: 'h', tick: 1, abilityId: 'autoAttack', amount: 60, critical: false } as const;

test('reading view displays a bounded header and ordered log rows', () => {
  const fixture = hudDocument();
  const view = new CombatReadingView(fixture.document, fixture.parent);
  view.receive([{ type: 'enraged', sourceId: 'boss', tick: 1 }, { type: 'phaseChanged', phase: 2, tick: 2 }], snapshot, 'h', {});
  view.update(snapshot, 0, viewport);
  expect(fixture.find('hud-header')[0].textContent).toBe('00:00 · Fase 1: Los nueve ríos');
  expect(fixture.find('hud-header')[0].style.width).toBe('320px');
  expect(fixture.find('hud-log-title')[0].textContent).toBe('Combate');
  expect(fixture.find('hud-log-row').slice(0, 2).map((row) => row.textContent)).toEqual(['¡Enfurecido!', 'Fase 2: Los guías']);
  expect(fixture.find('hud-log-row')[2].hidden).toBe(true);
  expect(fixture.find('hud-log')[0].style.transform).toBe('translate(864px, 348px)');
  fixture.writes.mockClear(); view.update(snapshot, 0, viewport);
  expect(fixture.writes).not.toHaveBeenCalled();
});

test('floating labels pool on receive, project, fade and expire without creating nodes in update', () => {
  const fixture = hudDocument();
  const view = new CombatReadingView(fixture.document, fixture.parent);
  view.receive([damage], snapshot, 'h', {});
  const count = fixture.created.length;
  view.update(snapshot, 500, viewport);
  const label = fixture.find('hud-floating')[0];
  expect(label.textContent).toBe('60');
  expect(label.hidden).toBe(false);
  expect(label.style).toMatchObject({ transform: 'translate(640px, 348px)', color: '#ffffff', opacity: '0.5', fontSize: '18px' });
  view.update(snapshot, 500, viewport); expect(label.hidden).toBe(true);
  view.receive([damage], snapshot, 'h', {}); view.update(snapshot, 0, viewport);
  expect(fixture.created).toHaveLength(count);
});

test('critical and healing labels hide over HUD or outside the viewport', () => {
  const fixture = hudDocument();
  const view = new CombatReadingView(fixture.document, fixture.parent);
  view.receive([{ ...damage, critical: true }], snapshot, 'h', { h: { x: 0, y: -20 } });
  view.update(snapshot, 0, viewport);
  expect(fixture.find('hud-floating')[0].hidden).toBe(true);
  expect(fixture.find('hud-floating')[0].style).toMatchObject({ color: '#ffe066', fontSize: '26px' });
  view.reset();
  view.receive([{ type: 'healing', sourceId: 'h', targetId: 'h', tick: 1, abilityId: 'remedy', amount: 120, effectiveAmount: 90, critical: false }], snapshot, 'h', {});
  view.update(snapshot, 0, { ...viewport, project: () => ({ x: -50, y: 400 }) });
  expect(fixture.find('hud-floating')[0].textContent).toBe('+90');
  expect(fixture.find('hud-floating')[0].style.color).toBe('#4cd964');
  expect(fixture.find('hud-floating')[0].hidden).toBe(true);
});

test('reset hides the log and all floating labels in the lobby', () => {
  const fixture = hudDocument();
  const view = new CombatReadingView(fixture.document, fixture.parent);
  view.receive([damage], snapshot, 'h', {}); view.update(snapshot, 0, viewport);
  view.reset(); view.update(room([], { status: 'lobby' }), 0, viewport);
  expect(fixture.find('hud-header')[0].hidden).toBe(true);
  expect(fixture.find('hud-log')[0].hidden).toBe(true);
  expect(fixture.find('hud-floating')[0].hidden).toBe(true);
});
