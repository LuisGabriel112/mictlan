import { describe, expect, test } from 'vitest';
import { BOSS } from '../src/index.js';
import type { AbilityRejectionReason, Input, PlayerAbilityId, PlayerEntity } from '../src/index.js';
import { scenario, player, cast, target, move, tick, advance, activeCast } from './ability-fixtures.js';
describe('T1.3 ability validation', () => {
  const rejections: {
    reason: AbilityRejectionReason;
    overrides: Partial<PlayerEntity>;
    inputs?: Input[];
  }[] = [
    { reason: 'gcd', overrides: { gcdRemainingTicks: 2 } },
    { reason: 'cooldown', overrides: { cooldowns: { remedy: 2 } } },
    { reason: 'insufficient_mana', overrides: { mana: 0 } },
    { reason: 'out_of_range', overrides: { x: 0, y: 20 } },
    { reason: 'moving', overrides: {}, inputs: [move()] },
    { reason: 'casting', overrides: { cast: activeCast() } },
    { reason: 'dead', overrides: { health: 0 } },
    { reason: 'dead', overrides: { health: -1 } },
  ];

  test.each(rejections)('rejects an ability with $reason', ({ reason, overrides, inputs = [] }) => {
    const state = scenario();
    Object.assign(player(state), { targetId: 'p1' }, overrides);
    const result = tick(state, [...inputs, cast()]);
    expect(result.events).toEqual([
      { type: 'abilityRejected', tick: 1, sourceId: 'p2', abilityId: 'remedy', reason },
    ]);
    expect(player(result.state).mana).toBeGreaterThanOrEqual(player(state).mana);
  });

  test.each([
    { name: 'dead before casting', overrides: { health: 0, cast: activeCast(), gcdRemainingTicks: 2 }, reason: 'dead' },
    { name: 'casting before GCD', overrides: { cast: activeCast(), gcdRemainingTicks: 2 }, reason: 'casting' },
    { name: 'GCD before cooldown and mana', overrides: { gcdRemainingTicks: 2, cooldowns: { remedy: 2 }, mana: 0 }, reason: 'gcd' },
    { name: 'cooldown before mana', overrides: { cooldowns: { remedy: 2 }, mana: 0 }, reason: 'cooldown' },
    { name: 'mana before target', overrides: { mana: 0, targetId: null }, reason: 'insufficient_mana' },
    { name: 'target before moving', overrides: { targetId: null }, reason: 'invalid_target', moving: true },
    { name: 'range before moving', overrides: { x: 0, y: 20 }, reason: 'out_of_range', moving: true },
  ])('checks $name', ({ overrides, reason, moving }) => {
    const state = scenario();
    Object.assign(player(state), { targetId: 'p1' }, overrides);
    expect(tick(state, [...(moving ? [move()] : []), cast()]).events).toEqual([
      { type: 'abilityRejected', tick: 1, sourceId: 'p2', abilityId: 'remedy', reason },
    ]);
  });

  test.each([
    { abilityId: 'remedy', playerId: 'p2', targetId: null },
    { abilityId: 'remedy', playerId: 'p2', targetId: 'missing' },
    { abilityId: 'remedy', playerId: 'p2', targetId: BOSS.id },
    { abilityId: 'remedy', playerId: 'p2', targetId: 'p1', health: 0 },
    { abilityId: 'remedy', playerId: 'p2', targetId: 'p1', health: -1 },
    { abilityId: 'quickShot', playerId: 'p3', targetId: null },
    { abilityId: 'quickShot', playerId: 'p3', targetId: 'missing' },
    { abilityId: 'quickShot', playerId: 'p3', targetId: 'p1' },
    { abilityId: 'quickShot', playerId: 'p3', targetId: BOSS.id, health: 0 },
  ] satisfies { abilityId: PlayerAbilityId; playerId: string; targetId: string | null; health?: number }[])(
    'rejects invalid $abilityId target $targetId with health $health',
    ({ abilityId, playerId, targetId, health }) => {
      const state = scenario();
      player(state, playerId).targetId = targetId;
      if (targetId !== null && health !== undefined) state.entities[targetId].health = health;
      const result = tick(state, [cast(abilityId, playerId)]);
      expect(result.events).toEqual([
        { type: 'abilityRejected', tick: 1, sourceId: playerId, abilityId, reason: 'invalid_target' },
      ]);
    },
  );

  test.each([
    { distance: 5.5, event: 'abilityResolved' },
    { distance: 5.6, event: 'abilityRejected' },
  ])('subtracts the boss body radius at $distance meters', ({ distance, event }) => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { x: distance, y: 0 });
    const result = tick(state, [target(BOSS.id, 'p1'), cast('claw', 'p1')]);
    expect(result.events).toEqual([
      event === 'abilityResolved'
        ? { type: event, tick: 1, sourceId: 'p1', abilityId: 'claw', targetId: BOSS.id }
        : { type: event, tick: 1, sourceId: 'p1', abilityId: 'claw', reason: 'out_of_range' },
    ]);
  });

  test.each([30.5, 30.6])('subtracts the ally body radius at %s meters', (distance) => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { x: -15, y: 0 });
    Object.assign(player(state), { x: distance - 15, y: 0 });
    const result = tick(state, [target(), cast()]);
    expect(result.events[0]).toMatchObject(distance === 30.5
      ? { type: 'castStarted' }
      : { type: 'abilityRejected', reason: 'out_of_range' });
  });

  test('an explicitly selected self is a valid ally in range', () => {
    const result = tick(scenario(), [target('p2'), cast()]);
    expect(result.events).toEqual([
      { type: 'castStarted', tick: 1, sourceId: 'p2', abilityId: 'remedy', targetId: 'p2', durationTicks: 30 },
    ]);
  });

  test.each([
    { abilityId: 'obsidianShield', targetId: 'p1' },
    { abilityId: 'roar', targetId: null },
  ] satisfies { abilityId: PlayerAbilityId; targetId: string | null }[])(
    '$abilityId ignores the selected target', ({ abilityId, targetId }) => {
      const state = scenario();
      player(state, 'p1').targetId = 'missing';
      expect(tick(state, [cast(abilityId, 'p1')]).events).toEqual([
        { type: 'abilityResolved', tick: 1, sourceId: 'p1', abilityId, targetId },
      ]);
    },
  );
});

describe('T1.3 timers and resolution', () => {
  test('instant abilities spend mana and start cooldown and GCD immediately', () => {
    const result = tick(scenario(), [cast('offering')]);
    expect(player(result.state)).toMatchObject({ mana: 850, gcdRemainingTicks: 20, cooldowns: { offering: 900 }, cast: null });
    expect(result.events).toEqual([
      { type: 'abilityResolved', tick: 1, sourceId: 'p2', abilityId: 'offering', targetId: null },
    ]);
  });

  test('GCD started at t allows a new ability exactly at t+20', () => {
    const started = tick(scenario(), [target(), cast('copal')]);
    let state = started.state;
    for (let offset = 1; offset < 20; offset += 1) {
      const result = tick(state, [cast('copal')]);
      expect(result.events).toEqual([
        { type: 'abilityRejected', tick: started.state.tick + offset, sourceId: 'p2', abilityId: 'copal', reason: 'gcd' },
      ]);
      expect(player(result.state).gcdRemainingTicks).toBe(20 - offset);
      state = result.state;
    }
    const ready = tick(state, [cast('copal')]);
    expect(ready.events).toEqual([
      { type: 'abilityResolved', tick: started.state.tick + 20, sourceId: 'p2', abilityId: 'copal', targetId: 'p1' },
    ]);
  });

  test('an own cooldown is available exactly at t+60', () => {
    const initial = scenario();
    Object.assign(player(initial, 'p1'), { x: 5.5, y: 0 });
    const started = tick(initial, [target(BOSS.id, 'p1'), cast('claw', 'p1')]);
    const waiting = advance(started.state, 58);
    const rejected = tick(waiting, [cast('claw', 'p1')]);
    expect(rejected.events[0]).toMatchObject({ type: 'abilityRejected', reason: 'cooldown' });
    expect(player(rejected.state, 'p1').cooldowns.claw).toBe(1);
    const ready = tick(rejected.state, [cast('claw', 'p1')]);
    expect(ready.events[0]).toMatchObject({ type: 'abilityResolved', tick: started.state.tick + 60 });
    expect(player(ready.state, 'p1').cooldowns.claw).toBe(60);
  });

  test('mana is charged at resolution, not at cast start, exactly at t+30', () => {
    const started = tick(scenario(), [target(), cast()]);
    expect(player(started.state)).toMatchObject({ mana: 1000, gcdRemainingTicks: 20, cooldowns: {}, cast: activeCast(30) });
    let state = started.state;
    for (let offset = 1; offset < 30; offset += 1) {
      const result = tick(state);
      expect(result.events).toEqual([]);
      expect(player(result.state).mana).toBe(1000);
      expect(player(result.state).cast?.remainingTicks).toBe(30 - offset);
      state = result.state;
    }
    const finished = tick(state);
    expect(player(finished.state)).toMatchObject({ mana: 960, cast: null, gcdRemainingTicks: 0, cooldowns: {} });
    expect(finished.events).toEqual([
      { type: 'castFinished', tick: started.state.tick + 30, sourceId: 'p2', abilityId: 'remedy', targetId: 'p1' },
      { type: 'abilityResolved', tick: started.state.tick + 30, sourceId: 'p2', abilityId: 'remedy', targetId: 'p1' },
    ]);
  });

  test('moving cancels without mana or cooldown cost and GCD keeps running', () => {
    const started = tick(scenario(), [target(), cast()]);
    const cancelled = tick(started.state, [move()]);
    expect(cancelled.events).toEqual([
      { type: 'castCancelled', tick: 2, sourceId: 'p2', abilityId: 'remedy', reason: 'moving' },
    ]);
    expect(player(cancelled.state)).toMatchObject({ mana: 1000, cast: null, cooldowns: {}, gcdRemainingTicks: 19 });
    expect(player(tick(cancelled.state).state).gcdRemainingTicks).toBe(18);
  });

  test.each(['warCry'] satisfies PlayerAbilityId[])(
    'off-GCD %s works during both GCD and an active cast', (abilityId) => {
      const started = tick(scenario(), [target(BOSS.id, 'p3'), cast('obsidianArrow', 'p3')]);
      const result = tick(started.state, [cast(abilityId, 'p3')]);
      expect(result.events).toEqual([
        { type: 'abilityResolved', tick: 2, sourceId: 'p3', abilityId, targetId: BOSS.id },
      ]);
      expect(player(result.state, 'p3')).toMatchObject({
        gcdRemainingTicks: 19, cast: { abilityId: 'obsidianArrow', remainingTicks: 39 },
        cooldowns: { [abilityId]: 300 },
      });
      expect(player(result.state, 'p3').x).toBe(player(started.state, 'p3').x);
      expect(player(result.state, 'p3').y).toBe(player(started.state, 'p3').y);
    },
  );

  test('off-GCD starts no GCD and still obeys its own cooldown', () => {
    const started = tick(scenario(), [cast('obsidianShield', 'p1')]);
    expect(player(started.state, 'p1').gcdRemainingTicks).toBe(0);
    const result = tick(started.state, [cast('obsidianShield', 'p1')]);
    expect(result.events[0]).toMatchObject({ type: 'abilityRejected', reason: 'cooldown' });
    expect(player(result.state, 'p1').cooldowns.obsidianShield).toBe(359);
  });

  test('all living players advance timers and mana without inputs; dead players and enemies do not', () => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { gcdRemainingTicks: 1, cooldowns: { claw: 1, taunt: 0 } });
    Object.assign(player(state), { mana: 0, gcdRemainingTicks: 1, cast: activeCast(2) });
    Object.assign(player(state, 'p3'), { health: 0, gcdRemainingTicks: 2, cooldowns: { flight: 2 }, cast: activeCast() });
    state.entities[BOSS.id].cast = { ...activeCast(), abilityId: 'flayedStrike' };
    const result = tick(state);
    expect(player(result.state, 'p1')).toMatchObject({ gcdRemainingTicks: 0, cooldowns: { claw: 0, taunt: 0 } });
    expect(player(result.state)).toMatchObject({ mana: 0.9, gcdRemainingTicks: 0, cast: activeCast(1) });
    expect(player(result.state, 'p3')).toBe(player(state, 'p3'));
    expect(result.state.entities[BOSS.id]).toBe(state.entities[BOSS.id]);
    expect(player(advance(result.state, 5), 'p1').cooldowns.claw).toBe(0);
  });

  test.each([
    { change: 'dead', reason: 'invalid_target' },
    { change: 'missing', reason: 'invalid_target' },
    { change: 'out of range', reason: 'out_of_range' },
  ])('cancels when the target is $change at resolution', ({ change, reason }) => {
    let state = tick(scenario(), [target(), cast()]).state;
    state = advance(state, 29);
    if (change === 'dead') state.entities.p1 = { ...state.entities.p1, health: 0 };
    if (change === 'missing') {
      state = { ...state, entities: { ...state.entities } };
      delete state.entities.p1;
    }
    if (change === 'out of range') state.entities.p1 = { ...state.entities.p1, x: 0, y: 20 };
    const result = tick(state);
    expect(result.events).toEqual([
      { type: 'castCancelled', tick: 31, sourceId: 'p2', abilityId: 'remedy', reason },
    ]);
    expect(player(result.state)).toMatchObject({ mana: 1000, cooldowns: {}, cast: null });
  });

  test.each(['dead', 'out of range'])('enemy casts revalidate a target that is %s', (change) => {
    let state = tick(scenario(), [target(BOSS.id, 'p3'), cast('obsidianArrow', 'p3')]).state;
    state = advance(state, 39);
    state.entities[BOSS.id] = { ...state.entities[BOSS.id], ...(change === 'dead' ? { health: 0 } : { y: 20 }) };
    const result = tick(state);
    expect(result.events).toEqual([
      { type: 'castCancelled', tick: 41, sourceId: 'p3', abilityId: 'obsidianArrow', reason: change === 'dead' ? 'invalid_target' : 'out_of_range' },
    ]);
    expect(player(result.state, 'p3')).toMatchObject({ cast: null, cooldowns: {} });
  });

  test('changing selection during a cast preserves its original target', () => {
    const started = tick(scenario(), [target(), cast()]);
    const changed = tick(started.state, [target('p3')]);
    expect(player(changed.state)).toMatchObject({ targetId: 'p3', cast: { targetId: 'p1' } });
    const finished = tick(advance(changed.state, 28));
    expect(finished.events.map((event) => 'targetId' in event && event.targetId)).toEqual(['p1', 'p1']);
  });
});

describe('T1.3 input and timer ordering', () => {
  test('processes target then the last move then cast, regardless of their arrival order', () => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { x: 5.6, y: 0 });
    const result = tick(state, [cast('claw', 'p1'), move(1, 0, 'p1'), target(BOSS.id, 'p1'), move(-1, 0, 'p1')]);
    expect(result.events[0]).toMatchObject({ type: 'abilityResolved', targetId: BOSS.id });
    expect(player(result.state, 'p1').x).toBeCloseTo(5.25);
  });

  test('processes all players by id, including movement before a later player validates range', () => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { x: -15.6, y: 0 });
    Object.assign(player(state), { x: 15, y: 0 });
    const inputs = [cast(), target(), move(1, 0, 'p1'), cast('obsidianShield', 'p1')];
    const result = tick(state, inputs);
    expect(result.events.map((event) => ({
      sourceId: 'sourceId' in event ? event.sourceId : null, type: event.type,
    }))).toEqual([
      { sourceId: 'p1', type: 'abilityResolved' },
      { sourceId: 'p2', type: 'castStarted' },
    ]);
    expect(result).toEqual(tick(state, [inputs[2], inputs[3], inputs[0], inputs[1]]));
  });

  test('the first cast wins, including when that first cast fails validation', () => {
    const result = tick(scenario(), [cast('offering'), cast('remedy'), cast('copal')]);
    expect(result.events).toEqual([
      { type: 'abilityResolved', tick: 1, sourceId: 'p2', abilityId: 'offering', targetId: null },
    ]);
    const rejected = tick(scenario(), [cast('remedy'), cast('offering')]);
    expect(rejected.events).toEqual([
      { type: 'abilityRejected', tick: 1, sourceId: 'p2', abilityId: 'remedy', reason: 'invalid_target' },
    ]);
  });

  test('foreign abilities and non-player senders are ignored without events', () => {
    const state = scenario();
    const result = tick(state, [
      cast('claw'), cast('offering'), cast('claw', BOSS.id), cast('offering', 'missing'),
      target('p1', BOSS.id), target('p1', 'missing'),
    ]);
    expect(result).toEqual({ state: { ...state, tick: 1 }, events: [] });
  });

  test('target accepts existing entities and null, ignoring nonexistent ids', () => {
    const state = scenario();
    const selected = tick(state, [target('p1')]);
    expect(player(selected.state).targetId).toBe('p1');
    const missing = tick(selected.state, [target('missing')]);
    expect(player(missing.state).targetId).toBe('p1');
    const enemy = tick(missing.state, [target(BOSS.id)]);
    expect(player(enemy.state).targetId).toBe(BOSS.id);
    const cleared = tick(enemy.state, [target(null)]);
    expect(player(cleared.state).targetId).toBeNull();
    expect([...selected.events, ...missing.events, ...enemy.events, ...cleared.events]).toEqual([]);
  });

  test('only the last move determines casting movement, and absent input is stationary', () => {
    const started = tick(scenario(), [move(), cast(), target(), move(0, 0)]);
    expect(started.events[0].type).toBe('castStarted');
    const still = tick(started.state, [move(), move(0, 0)]);
    expect(still.events).toEqual([]);
    expect(player(still.state).cast?.remainingTicks).toBe(29);
    const moved = tick(scenario(), [move()]);
    expect(tick(moved.state, [target(), cast()]).events[0].type).toBe('castStarted');
  });

  test('a nonzero move at the wall cancels even if the position is clamped', () => {
    const initial = scenario();
    Object.assign(player(initial), { x: 0, y: -20 });
    const started = tick(initial, [target(), cast()]);
    const result = tick(started.state, [move(0, -1)]);
    expect(result.events[0]).toMatchObject({ type: 'castCancelled', reason: 'moving' });
    expect(Math.hypot(player(result.state).x, player(result.state).y)).toBeCloseTo(20);
  });

  test('movement cancels the old cast before an attempted new cast is validated', () => {
    const started = tick(scenario(), [target(), cast()]);
    const result = tick(started.state, [cast(), move()]);
    expect(result.events).toEqual([
      { type: 'castCancelled', tick: 2, sourceId: 'p2', abilityId: 'remedy', reason: 'moving' },
      { type: 'abilityRejected', tick: 2, sourceId: 'p2', abilityId: 'remedy', reason: 'gcd' },
    ]);
  });

  test('completed casts resolve before this tick movement, retargeting and new casts', () => {
    const state = scenario();
    Object.assign(player(state, 'p1'), { x: -15.5, y: 0 });
    Object.assign(player(state), { x: 15, y: 0, mana: 1000, cast: activeCast(1) });
    const result = tick(state, [move(-1, 0, 'p1'), move(), target('p3'), cast('copal')]);
    expect(result.events).toEqual([
      { type: 'castFinished', tick: 1, sourceId: 'p2', abilityId: 'remedy', targetId: 'p1' },
      { type: 'abilityResolved', tick: 1, sourceId: 'p2', abilityId: 'remedy', targetId: 'p1' },
      { type: 'abilityResolved', tick: 1, sourceId: 'p2', abilityId: 'copal', targetId: 'p3' },
    ]);
    expect(player(result.state).mana).toBe(910);
    expect(player(result.state).cast).toBeNull();
  });

  test('a new cast can start on the same tick the previous cast finishes', () => {
    const started = tick(scenario(), [target(), cast()]);
    const result = tick(advance(started.state, 29), [cast()]);
    expect(result.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'castStarted']);
    expect(player(result.state).cast?.remainingTicks).toBe(30);
    expect(player(result.state).gcdRemainingTicks).toBe(20);
  });

  test('dead players cannot move and do not regenerate or advance a cast', () => {
    const state = scenario();
    Object.assign(player(state), { health: 0, mana: 0, cast: activeCast(1), gcdRemainingTicks: 2 });
    const result = tick(state, [move(), cast()]);
    expect(player(result.state)).toBe(player(state));
    expect(result.events).toEqual([
      { type: 'abilityRejected', tick: 1, sourceId: 'p2', abilityId: 'remedy', reason: 'dead' },
    ]);
  });
});
