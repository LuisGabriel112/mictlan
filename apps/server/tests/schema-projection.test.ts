import { expect, test, vi } from 'vitest';
import { syncFields, syncCollection } from '../src/schema/projection.js';

test('syncFields assigns only changed properties, including clearing optional values', () => {
  const writes = vi.fn(() => true);
  const view = new Proxy({ health: 100, targetId: 'boss', cast: 1 as number | undefined }, { set: writes });
  syncFields(view, { health: 100, targetId: '', cast: undefined });
  expect(writes.mock.calls.map((call) => call.slice(1, 3))).toEqual([
    ['targetId', ''], ['cast', undefined],
  ]);
});

test('syncCollection creates, updates, preserves and removes entries by id', () => {
  const existing = { id: 'kept', health: 100 };
  const entries = new Map([['kept', existing], ['removed', { id: 'removed', health: 1 }]]);
  const create = vi.fn(() => ({ id: '', health: 0 }));
  const update = vi.fn(syncFields);
  const set = vi.spyOn(entries, 'set');
  syncCollection(entries, [{ id: 'kept', health: 90 }, { id: 'added', health: 50 }], create, update);
  expect([...entries]).toEqual([['kept', { id: 'kept', health: 90 }], ['added', { id: 'added', health: 50 }]]);
  expect(entries.get('kept')).toBe(existing);
  expect(create).toHaveBeenCalledOnce();
  expect(set).toHaveBeenCalledExactlyOnceWith('added', { id: 'added', health: 50 });
  expect(update).toHaveBeenCalledTimes(2);
});
