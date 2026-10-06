import { describe, expect, test } from 'vitest';
import { BOSS } from '../src/index.js';
import type { Input } from '../src/index.js';
import { scenario, player, cast, target, move, tick, advance, activeCast, freezeDeep } from './ability-fixtures.js';
describe('T1.3 mana precision, purity and scope', () => {
  test('20 ticks regenerate exactly 18 mana from zero without floating-point drift', () => {
    const state = scenario();
    player(state).mana = 0;
    expect(player(advance(state, 20)).mana).toBe(18);
    expect(player(advance(state, 1000)).mana).toBe(900);
    expect(player(advance(state, 1200)).mana).toBe(1000);
  });

  test('regeneration occurs before validation and reaches an exact 40 mana cost', () => {
    const state = scenario();
    player(state).mana = 22;
    const ready = advance(state, 19);
    expect(player(ready).mana).toBe(39.1);
    const result = tick(ready, [target(), cast()]);
    expect(player(result.state).mana).toBe(40);
    expect(result.events[0].type).toBe('castStarted');
    const finished = tick(advance(result.state, 29));
    expect(player(finished.state).mana).toBe(27);
  });

  test('fractional mana remains exact after repeated spending and regeneration', () => {
    const state = scenario();
    player(state).mana = 50;
    let current = state;
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const result = tick(current, [target(), cast('copal')]);
      expect(result.events[0].type).toBe('abilityResolved');
      expect(player(result.state).mana).toBe((9 + cycle * 4) / 10);
      current = advance(result.state, 55);
    }
    expect(player(current).mana).toBe(54);
  });

  test('regeneration caps at maxMana before resolution costs are charged', () => {
    const state = scenario();
    Object.assign(player(state), { mana: 999.8, cast: activeCast(1) });
    expect(player(tick(state).state).mana).toBe(960);
  });

  test('step preserves frozen state and nested objects across timers, casting, cancellation and resolution', () => {
    let state = scenario();
    Object.assign(player(state), { mana: 500, cast: activeCast(2), gcdRemainingTicks: 2, cooldowns: { offering: 4 } });
    const inputsByTick: Input[][] = [[], [target('p3'), cast()], [move()]];
    for (const inputs of inputsByTick) {
      const before = structuredClone(state);
      const inputsBefore = structuredClone(inputs);
      freezeDeep(state);
      freezeDeep(inputs);
      const result = tick(state, inputs);
      expect(state).toEqual(before);
      expect(inputs).toEqual(inputsBefore);
      expect(player(result.state)).not.toBe(player(state));
      expect(player(result.state).cooldowns).not.toBe(player(state).cooldowns);
      expect(player(result.state).auras).toBe(player(state).auras);
      expect(player(result.state, 'p1')).toBe(player(state, 'p1'));
      expect(result.state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
      state = result.state;
    }
  });

  test('instant resolution creates a new cooldown map without mutating frozen idle state', () => {
    const state = scenario();
    player(state).cooldowns = { remedy: 0 };
    const before = structuredClone(state);
    freezeDeep(state);

    const result = tick(state, [cast('offering')]);

    expect(state).toEqual(before);
    expect(player(result.state)).not.toBe(player(state));
    expect(player(result.state).cooldowns).not.toBe(player(state).cooldowns);
    expect(player(result.state)).toMatchObject({
      mana: 850, gcdRemainingTicks: 20, cooldowns: { remedy: 0, offering: 900 },
    });
    expect(result.events).toEqual([
      { type: 'abilityResolved', tick: 1, sourceId: 'p2', abilityId: 'offering', targetId: null },
    ]);
    expect(player(result.state, 'p1')).toBe(player(state, 'p1'));
    expect(result.state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
  });

  test.each(['invalid_target', 'out_of_range'] as const)(
    'cancelling at resolution for %s preserves frozen state and only regenerates mana', (reason) => {
      const state = scenario();
      Object.assign(player(state), {
        mana: 500, gcdRemainingTicks: 2, cooldowns: { offering: 0 }, cast: activeCast(1),
      });
      Object.assign(player(state, 'p1'), reason === 'invalid_target' ? { health: 0 } : { x: 0, y: 20 });
      const before = structuredClone(state);
      freezeDeep(state);

      const result = tick(state);

      expect(state).toEqual(before);
      expect(player(result.state)).not.toBe(player(state));
      expect(player(result.state)).toMatchObject({
        mana: 500.9, gcdRemainingTicks: 1, cooldowns: { offering: 0 }, cast: null,
      });
      expect(result.events).toEqual([
        { type: 'castCancelled', tick: 1, sourceId: 'p2', abilityId: 'remedy', reason },
      ]);
      expect(player(result.state, 'p1')).toBe(player(state, 'p1'));
    },
  );

  test('same seed and ability inputs reproduce state and events over 200 ticks', () => {
    let first = scenario();
    let second = scenario();
    for (let index = 0; index < 200; index += 1) {
      const inputs = index % 2 === 0
        ? [target(), cast(), target(BOSS.id, 'p3'), cast('obsidianArrow', 'p3')]
        : [move(0, 0), cast('warCry', 'p3')];
      const result = tick(first, inputs);
      const repeated = tick(second, [...inputs].sort((left, right) => right.playerId < left.playerId ? -1 : right.playerId > left.playerId ? 1 : 0));
      expect(result).toEqual(repeated);
      first = result.state;
      second = repeated.state;
    }
  });

});
