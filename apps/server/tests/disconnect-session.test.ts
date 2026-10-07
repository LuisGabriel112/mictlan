import { expect, test, vi } from 'vitest';
import { removePlayer, step } from '@mictlan/core';
import { CombatSession } from '../src/combat-session.js';
import { encounterFixture } from './schema-fixture.js';

test('disconnect applies the injected removal before the next step and returns its events', () => {
  const encounter = encounterFixture();
  const removal = vi.fn(removePlayer);
  const advance = vi.fn(step);
  const session = new CombatSession(encounter, advance, removal);
  const expected = removePlayer(encounter, 'eagle');
  expect(session.disconnect('eagle')).toEqual(expected.events);
  expect(removal).toHaveBeenCalledExactlyOnceWith(encounter, 'eagle');
  expect(advance).not.toHaveBeenCalled();
  expect(session.state).toEqual(expected.state);
  expect(session.advance(49)).toEqual([]);
  session.advance(1);
  expect(advance.mock.calls[0][0]).toEqual(expected.state);
  expect(session.finished).toBe(false);
});

test('duplicate and unknown disconnects produce no additional events', () => {
  const session = new CombatSession(encounterFixture(), step, removePlayer);
  session.disconnect('eagle');
  expect(session.disconnect('eagle')).toEqual([]);
  expect(session.disconnect('missing')).toEqual([]);
  expect(session.advance(50).filter(({ type }) => type === 'death')).toEqual([]);
});

test.each(['victory', 'defeat'] as const)('disconnect cannot modify a frozen %s encounter', (status) => {
  const encounter = { ...encounterFixture(), status };
  const removal = vi.fn(removePlayer);
  const session = new CombatSession(encounter, step, removal);
  expect(session.disconnect('eagle')).toEqual([]);
  expect(session.state).toBe(encounter);
  expect(removal).not.toHaveBeenCalled();
});
