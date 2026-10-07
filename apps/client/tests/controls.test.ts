import { describe, expect, test } from 'vitest';
import { keyAction } from '../src/keyboard';
import { allyAt, entityAtPoint, nextEnemyTarget } from '../src/targeting';
import { entity, room } from './fixtures';

describe('keyAction', () => {
  test.each([
    [{ code: 'Tab', shiftKey: false }, { action: { type: 'cycleEnemy' }, preventDefault: true }],
    [{ code: 'F1', shiftKey: false }, { action: { type: 'ally', index: 1 }, preventDefault: true }],
    [{ code: 'F5', shiftKey: false }, { action: { type: 'ally', index: 5 }, preventDefault: true }],
    [{ code: 'Digit3', shiftKey: true }, { action: { type: 'ally', index: 3 }, preventDefault: true }],
    [{ code: 'Digit5', shiftKey: true }, { action: { type: 'ally', index: 5 }, preventDefault: true }],
    [{ code: 'KeyQ', shiftKey: false }, { action: { type: 'cast', slot: 1 }, preventDefault: false }],
    [{ code: 'KeyW', shiftKey: false }, { action: { type: 'cast', slot: 2 }, preventDefault: false }],
    [{ code: 'KeyE', shiftKey: false }, { action: { type: 'cast', slot: 3 }, preventDefault: false }],
    [{ code: 'KeyR', shiftKey: false }, { action: { type: 'cast', slot: 4 }, preventDefault: false }],
    [{ code: 'KeyQ', shiftKey: true }, { action: { type: 'cast', slot: 1 }, preventDefault: false }],
    [{ code: 'Digit2', shiftKey: false }, { action: null, preventDefault: false }],
    [{ code: 'Numpad4', shiftKey: false }, { action: null, preventDefault: false }],
    [{ code: 'Digit5', shiftKey: false }, { action: null, preventDefault: false }],
    [{ code: 'F6', shiftKey: false }, { action: null, preventDefault: false }],
    [{ code: 'KeyA', shiftKey: false }, { action: null, preventDefault: false }],
    [{ code: 'KeyS', shiftKey: false }, { action: { type: 'stop' }, preventDefault: false }],
  ])('%j', (event, expected) => {
    expect(keyAction(event)).toEqual(expected);
  });
});

describe('nextEnemyTarget', () => {
  const snapshot = room([
    entity({ id: 'p1', x: 0, y: 0 }),
    entity({ id: 'boss', type: 'boss', classId: '', x: 10, y: 0 }),
    entity({ id: 'xolo-1', type: 'xolo', classId: '', x: 0, y: 4 }),
    entity({ id: 'xolo-2', type: 'xolo', classId: '', x: 1, y: 0, health: 0 }),
  ]);

  test('starts with the nearest living enemy', () => {
    expect(nextEnemyTarget(snapshot, 'p1', '')).toBe('xolo-1');
  });

  test('advances to the next farther enemy and wraps around', () => {
    expect(nextEnemyTarget(snapshot, 'p1', 'xolo-1')).toBe('boss');
    expect(nextEnemyTarget(snapshot, 'p1', 'boss')).toBe('xolo-1');
  });

  test('a friendly or dead current target restarts from the nearest', () => {
    expect(nextEnemyTarget(snapshot, 'p1', 'p1')).toBe('xolo-1');
    expect(nextEnemyTarget(snapshot, 'p1', 'xolo-2')).toBe('xolo-1');
  });

  test('without living enemies there is no target', () => {
    expect(nextEnemyTarget(room([entity({ id: 'p1' })]), 'p1', '')).toBeUndefined();
  });

  test('equal distances break ties by id', () => {
    const tied = room([
      entity({ id: 'p1' }), entity({ id: 'xolo-b', type: 'xolo', classId: '', x: 3 }),
      entity({ id: 'xolo-a', type: 'xolo', classId: '', x: -3 }),
    ]);
    expect(nextEnemyTarget(tied, 'p1', '')).toBe('xolo-a');
  });

  test('a missing self measures from the origin', () => {
    expect(nextEnemyTarget(snapshot, 'ghost', '')).toBe('xolo-1');
  });
});

describe('allyAt', () => {
  const snapshot = room([
    entity({ id: 'p2' }), entity({ id: 'p3' }), entity({ id: 'p1' }),
    entity({ id: 'boss', type: 'boss', classId: '' }),
  ]);

  test('party order is self first, then the other players by id', () => {
    expect([1, 2, 3, 4].map((index) => allyAt(snapshot, 'p3', index))).toEqual(['p3', 'p1', 'p2', undefined]);
  });

  test('dead allies can still be selected', () => {
    const withDead = room([entity({ id: 'p1' }), entity({ id: 'p2', health: 0 })]);
    expect(allyAt(withDead, 'p1', 2)).toBe('p2');
  });
});

describe('entityAtPoint', () => {
  const snapshot = room([
    entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0 }),
    entity({ id: 'p1', x: 3, y: 0 }),
  ]);

  test('selects the entity whose body contains the point', () => {
    expect(entityAtPoint(snapshot, { x: 1, y: 1 })).toBe('boss');
    expect(entityAtPoint(snapshot, { x: 3.2, y: 0.2 })).toBe('p1');
  });

  test('misses return nothing', () => {
    expect(entityAtPoint(snapshot, { x: 10, y: 10 })).toBeUndefined();
  });

  test('overlapping bodies prefer the closest center', () => {
    const overlapping = room([
      entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0 }), entity({ id: 'p1', x: 1, y: 0 }),
    ]);
    expect(entityAtPoint(overlapping, { x: 1.1, y: 0 })).toBe('p1');
  });
});
