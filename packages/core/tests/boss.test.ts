import { expect, test } from 'vitest';
import { advanceBossAbilities, advanceBossEncounter } from '../src/boss.js';
import { BOSS } from '../src/data/boss.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';
import { enemyEncounter, repeatBoss, repeatTick } from './enemy-fixtures.js';

test('C1: inactive boss and encounter clocks stay frozen before pull', () => {
  const initial = combatEncounter();
  initial.entities.boss.autoAttackRemainingTicks = 9;
  initial.bossAbilityTimers = { flayedStrike: 1 };
  freezeCombat(initial);
  const result = repeatTick(initial, 200);
  expect(result.events).toEqual([]);
  expect(result.state).toMatchObject({ bossActive: false, elapsedTicks: 0, phaseElapsedTicks: 0, bossAbilityTimers: { flayedStrike: 1 } });
  expect(result.state.entities.boss).toBe(initial.entities.boss);
});

test.each(['damage', 'healing', 'distance'])(
  'C1: pull by %s counts the first encounter and phase tick and initializes timers', (trigger) => {
    const initial = combatEncounter();
    initial.tick = 100;
    if (trigger === 'damage') readyCast(initial, 'obsidianArrow', 'p3', BOSS.id);
    if (trigger === 'healing') readyCast(initial, 'remedy', 'p2', 'p1');
    if (trigger === 'healing') initial.entities.p1.health = 1100;
    if (trigger === 'distance') Object.assign(initial.entities.p1, { x: 11.5, y: 0 });
    const result = combatTick(initial);
    expect(result.state).toMatchObject({ tick: 101, bossActive: true, elapsedTicks: 1, phaseElapsedTicks: 1 });
    expect(result.state.bossAbilityTimers).toEqual({ flayedStrike: 199, obsidianWind: 119, lamentOfTheDead: 279 });
    expect(combatTick(result.state).state).toMatchObject({ elapsedTicks: 2, phaseElapsedTicks: 2 });
  },
);

test('pull ignores zero threat, overhealing and dead nearby players', () => {
  const initial = combatEncounter();
  Object.assign(initial.entities.p1, { health: 0, x: 0, y: 0 });
  Object.assign(initial.entities.p3, { x: 11.5001, y: 0 });
  threatEnemy(initial).threat = { p1: 100, p2: 0 };
  readyCast(initial, 'remedy', 'p2', 'p2');
  const result = combatTick(initial);
  expect(result.state.bossActive).toBe(false);
  expect(result.state.elapsedTicks).toBe(0);
  expect(result.state.bossAbilityTimers).toEqual({});
});

test('advanceBossEncounter initializes data timers once and leaves dead or missing bosses unchanged', () => {
  const initial = enemyEncounter();
  initial.bossAbilityTimers = { flayedStrike: 7 };
  expect(advanceBossEncounter(initial)).toMatchObject({ elapsedTicks: 1, phaseElapsedTicks: 1, bossAbilityTimers: { flayedStrike: 7 } });
  initial.bossActive = false;
  initial.entities.boss.health = 0;
  expect(advanceBossEncounter(initial)).toBe(initial);
  delete initial.entities.boss;
  expect(advanceBossEncounter(initial)).toBe(initial);
});

test('first Flayed Strike starts on elapsed tick 200 with a full non-interruptible 50 tick cast', () => {
  const initial = combatEncounter();
  Object.assign(initial.entities.p1, { x: 11.5, y: 0 });
  const before = repeatTick(initial, 199);
  expect(before.events.filter((event) => 'abilityId' in event && event.abilityId === 'flayedStrike')).toEqual([]);
  const started = combatTick(before.state);
  expect(started.events).toContainEqual({ type: 'castStarted', tick: 200, sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: null, durationTicks: 50 });
  expect(started.state.entities.boss.cast).toMatchObject({ remainingTicks: 50, interruptible: false });
  expect(started.state.bossAbilityTimers.flayedStrike).toBe(400);
});

test('C3: Strike locks its original target and hits after it moves away and aggro changes', () => {
  const initial = enemyEncounter('p1', 4.5);
  initial.bossAbilityTimers = { flayedStrike: 1 };
  const started = advanceBossAbilities(initial);
  Object.assign(started.state.entities.p1, { x: 19, y: 0 });
  threatEnemy(started.state).targetId = 'p3';
  const waiting = repeatBoss(started.state, 49);
  expect(waiting.events).toEqual([]);
  expect(waiting.state.entities.boss.cast?.remainingTicks).toBe(1);
  const finished = advanceBossAbilities(waiting.state);
  expect(finished.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'damage']);
  expect(finished.events[2]).toMatchObject({ sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', amount: 280, critical: false });
  expect(finished.state.entities.p3).toBe(initial.entities.p3);
  expect(finished.state.entities.boss.cast).toBeNull();
});

test('Strike resolves for 140 against the Jaguar using a real active Shield', () => {
  const initial = enemyEncounter('p1', 15);
  initial.bossAbilityTimers = { flayedStrike: 1 };
  initial.entities.boss.autoAttackRemainingTicks = 100;
  const started = combatTick(initial, [combatCast('obsidianShield', 'p1')]);
  const result = repeatTick(started.state, 50);
  const strikes = result.events.filter((event) => event.type === 'damage' && event.abilityId === 'flayedStrike');
  expect(strikes).toEqual([{ type: 'damage', tick: 51, sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', amount: 140, critical: false }]);
});

test.each([null, 'missing', 'dead'])(
  'Strike resolves without damage when its locked target is %s', (targetId) => {
    const initial = enemyEncounter();
    initial.entities.dead = { ...initial.entities.p1, id: 'dead', health: 0 };
    initial.entities.boss.cast = { abilityId: 'flayedStrike', targetId, durationTicks: 50, remainingTicks: 1, interruptible: false };
    const result = advanceBossAbilities(initial);
    expect(result.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved']);
    expect(result.state.entities.boss.cast).toBeNull();
  },
);

test('C4: due Lament queues once, starts at Strike completion and resets from its actual start', () => {
  const initial = enemyEncounter();
  initial.bossAbilityTimers = { flayedStrike: 1, lamentOfTheDead: 2 };
  const started = advanceBossAbilities(initial);
  const queued = repeatBoss(started.state, 49);
  expect(queued.state.bossAbilityQueue).toEqual(['lamentOfTheDead']);
  expect(queued.state.bossAbilityTimers.lamentOfTheDead).toBe(0);
  expect(queued.events).toEqual([]);
  const released = advanceBossAbilities(queued.state);
  expect(released.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'damage', 'castStarted']);
  expect(released.events.at(-1)).toMatchObject({ abilityId: 'lamentOfTheDead', durationTicks: 60 });
  expect(released.state.bossAbilityQueue).toEqual([]);
  expect(released.state.bossAbilityTimers).toEqual({ flayedStrike: 350, lamentOfTheDead: 500 });
  expect(advanceBossAbilities(released.state).state.bossAbilityTimers.lamentOfTheDead).toBe(499);
});

test('Lament emits completion and resolution with no raid damage', () => {
  const initial = enemyEncounter();
  initial.bossAbilityTimers = { lamentOfTheDead: 0 };
  const started = advanceBossAbilities(initial);
  expect(started.state.entities.boss.cast).toMatchObject({ remainingTicks: 60, interruptible: true });
  const completed = repeatBoss(started.state, 60);
  expect(completed.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved']);
  expect(completed.state.entities.p1).toBe(initial.entities.p1);
});

test('queued Lament next starts exactly 500 ticks after its delayed start', () => {
  const initial = enemyEncounter();
  initial.entities.boss.cast = { abilityId: 'flayedStrike', targetId: 'p1', durationTicks: 50, remainingTicks: 3, interruptible: false };
  initial.bossAbilityTimers = { lamentOfTheDead: 1 };
  const released = repeatBoss(initial, 3);
  expect(released.state.entities.boss.cast?.abilityId).toBe('lamentOfTheDead');
  const waiting = repeatBoss(released.state, 499);
  expect(waiting.events.filter((event) => event.type === 'castStarted')).toEqual([]);
  expect(waiting.state.bossAbilityTimers.lamentOfTheDead).toBe(1);
  expect(advanceBossAbilities(waiting.state).events[0]).toMatchObject({ type: 'castStarted', abilityId: 'lamentOfTheDead' });
});

test('Wind and Call execute during Strike without replacing it or creating effects', () => {
  const initial = enemyEncounter();
  initial.phase = 2;
  initial.bossAbilityTimers = { flayedStrike: 1, obsidianWind: 2, callOfTheXolos: 2 };
  const started = advanceBossAbilities(initial);
  const result = advanceBossAbilities(started.state);
  expect(result.events.map((event) => 'abilityId' in event && [event.type, event.abilityId])).toEqual([
    ['castStarted', 'obsidianWind'], ['abilityResolved', 'obsidianWind'],
    ['castStarted', 'callOfTheXolos'], ['abilityResolved', 'callOfTheXolos'],
  ]);
  expect(result.state.entities.boss.cast).toMatchObject({ abilityId: 'flayedStrike', remainingTicks: 49 });
  expect(result.state.bossAbilityTimers).toMatchObject({ obsidianWind: 240, callOfTheXolos: 800 });
  expect(result.state.zones).toBe(initial.zones);
  expect(Object.keys(result.state.entities)).toEqual(Object.keys(initial.entities));
  expect(result.state.rngState).toBe(initial.rngState);
});

test('existing queue precedes newly due casts and simultaneous deadlines follow phase table order', () => {
  const initial = enemyEncounter();
  initial.bossAbilityQueue = ['lamentOfTheDead'];
  initial.bossAbilityTimers = { flayedStrike: 1, lamentOfTheDead: 0 };
  const result = advanceBossAbilities(initial);
  expect(result.state.entities.boss.cast?.abilityId).toBe('lamentOfTheDead');
  expect(result.state.bossAbilityQueue).toEqual(['flayedStrike']);
  initial.bossAbilityQueue = [];
  const simultaneous = advanceBossAbilities(initial);
  expect(simultaneous.state.entities.boss.cast?.abilityId).toBe('flayedStrike');
  expect(simultaneous.state.bossAbilityQueue).toEqual(['lamentOfTheDead']);
});

test('scheduler uses current phase intervals and ignores abilities absent from that phase', () => {
  const initial = enemyEncounter();
  initial.phase = 3;
  initial.bossAbilityTimers = { obsidianWind: 1, lamentOfTheDead: 1 };
  const result = advanceBossAbilities(initial);
  expect(result.events).toHaveLength(1);
  expect(result.events[0]).toMatchObject({ abilityId: 'lamentOfTheDead' });
  expect(result.state.bossAbilityTimers).toEqual({ obsidianWind: 1, lamentOfTheDead: 360 });
  expect(result.state.phase).toBe(3);
  expect(result.state.enraged).toBe(false);
});

test.each(['inactive', 'dead', 'missing'])(
  'scheduler preserves %s boss state and timers', (condition) => {
    const initial = enemyEncounter();
    initial.bossAbilityTimers = { flayedStrike: 1 };
    if (condition === 'inactive') initial.bossActive = false;
    if (condition === 'dead') initial.entities.boss.health = 0;
    if (condition === 'missing') delete initial.entities.boss;
    expect(advanceBossAbilities(initial)).toEqual({ state: initial, events: [] });
  },
);

test('step applies Jaguar threat before pull and final enemy target selection', () => {
  const initial = combatEncounter();
  Object.assign(combatPlayer(initial, 'p1'), { x: 5.5, y: 0, targetId: BOSS.id });
  const result = combatTick(initial);
  expect(result.state.bossActive).toBe(true);
  expect(threatEnemy(result.state)).toMatchObject({ targetId: 'p1', threat: { p1: 60 }, x: 0.25 });
  expect(result.events[0]).toMatchObject({ sourceId: 'p1', abilityId: 'autoAttack', amount: 20 });
});

test('step resolves boss casts before movement and attack and orders enemies by id', () => {
  const initial = enemyEncounter('p1', 4.5);
  initial.entities.z = { ...threatEnemy(initial), id: 'z', type: 'xolo' };
  initial.entities.a = { ...threatEnemy(initial), id: 'a', type: 'xolo' };
  initial.bossAbilityTimers = { flayedStrike: 1 };
  const result = combatTick(initial);
  expect(result.events.map((event) => 'sourceId' in event && event.sourceId)).toEqual(['a', BOSS.id, 'z']);
  expect(result.events[1]).toMatchObject({ type: 'castStarted' });
  expect(result.state.entities.boss).toMatchObject({ x: 0, y: 0 });
});

test('scheduler and step are deterministic, immutable and reuse untouched entities', () => {
  const initial = enemyEncounter();
  initial.bossAbilityTimers = { flayedStrike: 1, lamentOfTheDead: 1 };
  const original = structuredClone(initial);
  freezeCombat(initial);
  const result = combatTick(initial);
  expect(result).toEqual(combatTick(initial));
  expect(initial).toEqual(original);
  expect(result.state.entities.p2).toBe(initial.entities.p2);
  expect(result.state.entities.p3).toBe(initial.entities.p3);
});
