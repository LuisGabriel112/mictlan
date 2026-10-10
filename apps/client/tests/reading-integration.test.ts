import { expect, test } from 'vitest';
import { Hud } from '../src/scene/hud';
import { room, entity } from './fixtures';
import { hudDocument } from './hud-dom-fixtures';
import { arenaFixture } from './arena-dom-fixtures';
import { legacyProjection } from './world-fixtures';
import { actionSlotRects, dodgeSlotRect } from '../src/reading-layout';

const viewport = { width: 1280, height: 720, project: legacyProjection };

test('Hud connects reading, five slots, resize layout and timed rejection', () => {
  const fixture = hudDocument();
  const hud = new Hud(fixture.document, fixture.parent);
  const snapshot = room([entity({ id: 'h', classId: 'healer', cooldowns: { dodge: { id: 'dodge', remainingTicks: 40 } } })]);
  hud.receiveCombatEvents([{ type: 'enraged', tick: 1, sourceId: 'boss' }], snapshot, 'h', {});
  hud.showFlash('Sin maná', 100); hud.update(snapshot, 'h', 100, 0, viewport);
  expect(fixture.find('hud-log-row')[0].textContent).toBe('¡Enfurecido!');
  expect(fixture.find('hud-slot')).toHaveLength(5);
  expect(fixture.find('hud-slot-key').map((node) => node.textContent)).toEqual(['1', '2', '3', '4', 'Espacio']);
  expect(fixture.find('hud-slot-caption')[4].textContent).toBe('2.0');
  expect(fixture.find('hud-flash')[0].textContent).toBe('Sin maná');
  hud.update(snapshot, 'h', 1600, 0, { ...viewport, width: 1000 });
  expect(fixture.find('hud-flash')[0].hidden).toBe(true);
  const rectangles = [...actionSlotRects(1000, 720), dodgeSlotRect(1000, 720)];
  fixture.find('hud-slot').forEach((slot, index) => expect(slot.style.transform).toBe(`translate(${rectangles[index].x}px, ${rectangles[index].y}px)`));
});

test('HUD handles missing self and clears reading, rejection and visibility for lobby', () => {
  const fixture = hudDocument(); const hud = new Hud(fixture.document, fixture.parent);
  hud.showFlash('En recarga', 0); hud.resetReading();
  hud.update(room([], { status: 'lobby' }), 'h', 0, 0, viewport);
  expect(fixture.find('arena-hud')[0].hidden).toBe(true);
  hud.update(room([]), 'h', 0, 0, viewport);
  expect(fixture.find('hud-slot-name').every((node) => node.textContent === '')).toBe(true);
  expect(fixture.find('hud-flash')[0].hidden).toBe(true);
  fixture.writes.mockClear(); hud.update(room([]), 'h', 0, 0, viewport);
  expect(fixture.writes).not.toHaveBeenCalled();
});

test('arena wires pre-state events safely, projects damage and clears reading for lobby', () => {
  const fixture = arenaFixture(); fixture.events([{ type: 'enraged', tick: 0, sourceId: 'boss' }]);
  fixture.state(room([entity({ id: 'self' })]));
  fixture.events([{ type: 'damage', tick: 1, sourceId: 'boss', targetId: 'self', abilityId: 'autoAttack', amount: 60, critical: false }]);
  fixture.arena.update(200, 500);
  expect(fixture.find('hud-floating')[0].textContent).toBe('60');
  expect(fixture.find('hud-floating')[0].hidden).toBe(false);
  fixture.events([{ type: 'abilityRejected', tick: 1, sourceId: 'self', abilityId: 'obsidianArrow', reason: 'gcd' }]);
  fixture.arena.update(200, 0); expect(fixture.find('hud-flash')[0].hidden).toBe(false);
  fixture.state(room([], { status: 'lobby' }));
  expect(fixture.find('arena-hud')[0].hidden).toBe(true);
  fixture.state(room([entity({ id: 'self' })])); fixture.arena.update(300, 0);
  expect(fixture.find('hud-floating')[0].hidden).toBe(true);
});
