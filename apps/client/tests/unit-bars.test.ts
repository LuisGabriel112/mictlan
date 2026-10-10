import { expect, test, vi } from 'vitest';
import { UnitBars } from '../src/scene/unit-bars';
import { UNIT_HEIGHTS } from '../src/world-3d/arena-world';
import { entity, room } from './fixtures';
import { hudDocument } from './hud-dom-fixtures';

test('unit bars project interpolated heads and cache their compact tracks', () => {
  const fixture = hudDocument();
  const bars = new UnitBars(fixture.document, fixture.parent);
  const snapshot = room([entity({ id: 'p', health: 25, maxHealth: 100, x: 9 })]);
  const project = vi.fn(() => ({ x: 20, y: 400 }));
  bars.sync(snapshot); bars.update(snapshot, { p: { x: 2, y: 0 } }, project);
  expect(project).toHaveBeenCalledWith({ x: 2, y: 0 }, UNIT_HEIGHTS.player + 0.5);
  expect(fixture.find('hud-unit-bar')[0].style).toMatchObject({ transform: 'translate(4px, 396px)', width: '32px', height: '4px' });
  expect(fixture.find('hud-unit-fill')[0].style.transform).toBe('scaleX(0.25)');
  fixture.writes.mockClear(); bars.update(snapshot, { p: { x: 2, y: 0 } }, project);
  expect(fixture.writes).not.toHaveBeenCalled();
});

test('bars pool on state changes, widen for bosses, hide dead/removed units and clamp overheal', () => {
  const fixture = hudDocument();
  const bars = new UnitBars(fixture.document, fixture.parent);
  const snapshot = room([entity({ id: 'boss', type: 'boss', classId: '', health: 150, maxHealth: 100 }), entity({ id: 'dead', health: 0 })]);
  bars.sync(snapshot); const count = fixture.created.length;
  bars.update(snapshot, {}, () => ({ x: 640, y: 300 }));
  expect(fixture.find('hud-unit-bar')[0].style.width).toBe('84px');
  expect(fixture.find('hud-unit-fill')[0].style.transform).toBe('scaleX(1)');
  expect(fixture.find('hud-unit-bar')[1].hidden).toBe(true);
  bars.sync(room([]));
  expect(fixture.find('hud-unit-bar').every((bar) => bar.hidden)).toBe(true);
  bars.sync(snapshot); bars.update(snapshot, {}, () => ({ x: 640, y: 300 }));
  expect(fixture.created).toHaveLength(count);
});
