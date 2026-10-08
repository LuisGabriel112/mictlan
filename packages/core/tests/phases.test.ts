import { expect, test } from 'vitest';
import { BOSS, BOSS_ABILITIES, BOSS_PHASES } from '../src/data/boss.js';
import { updateBossPhase } from '../src/phases.js';
import type { EncounterState, Phase } from '../src/types.js';
import { combatEncounter, combatTick, freezeCombat, readyCast } from './combat-fixtures.js';
import { enemyEncounter, repeatTick } from './enemy-fixtures.js';

function withBossHealth(state: EncounterState, health: number): EncounterState {
  return { ...state, entities: { ...state.entities, [BOSS.id]: { ...state.entities[BOSS.id], health } } };
}

function beforeFirstPhaseTick(phase: Phase): EncounterState {
  const initial = combatEncounter();
  Object.assign(initial.entities.p1, { x: 11.5, y: 0 });
  if (phase === 1) return initial;
  initial.entities.boss.health = phase === 2 ? BOSS.maxHealthByPlayerCount[3] * 0.65 : BOSS.maxHealthByPlayerCount[3] * 0.30;
  const entered = combatTick(initial);
  expect(entered.state).toMatchObject({ phase, phaseElapsedTicks: 0 });
  return entered.state;
}

test('C1: 66% stays in phase 1, 65% enters phase 2 and 30% enters phase 3', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  const above = combatTick(withBossHealth(initial, BOSS.maxHealthByPlayerCount[3] * 0.66));
  expect(above.state.phase).toBe(1);
  expect(above.events).toEqual([]);
  const second = combatTick(withBossHealth(above.state, BOSS.maxHealthByPlayerCount[3] * 0.65));
  expect(second.state.phase).toBe(2);
  expect(second.events).toEqual([{ type: 'phaseChanged', phase: 2, tick: 2 }]);
  const third = combatTick(withBossHealth(second.state, BOSS.maxHealthByPlayerCount[3] * 0.30));
  expect(third.state.phase).toBe(3);
  expect(third.events.at(-1)).toEqual({ type: 'phaseChanged', phase: 3, tick: 3 });
});

test('C1: crossing both thresholds in one tick jumps directly from phase 1 to phase 3', () => {
  const initial = combatEncounter();
  Object.assign(initial.entities.boss, { health: 200, maxHealth: 200 });
  readyCast(initial, 'obsidianArrow', 'p3', BOSS.id);
  const result = combatTick(initial);
  expect(result.state.entities.boss.health).toBe(60);
  expect(result.state.phase).toBe(3);
  expect(result.events.filter(({ type }) => type === 'phaseChanged')).toEqual([
    { type: 'phaseChanged', phase: 3, tick: 1 },
  ]);
  expect(result.events.at(-1)?.type).toBe('phaseChanged');
});

test.each([{ health: BOSS.maxHealthByPlayerCount[3] * 0.65 + 1, phase: 1 }, { health: BOSS.maxHealthByPlayerCount[3] * 0.30 + 1, phase: 2 }])(
  'integer threshold comparison keeps health $health above phase $phase boundary', ({ health, phase }) => {
    const initial = combatEncounter();
    initial.bossActive = true;
    expect(combatTick(withBossHealth(initial, health)).state.phase).toBe(phase);
  },
);

test('phases never regress or emit another phaseChanged event after healing', () => {
  for (const phase of [2, 3] as const) {
    const entered = beforeFirstPhaseTick(phase);
    const healed = combatTick(withBossHealth(entered, entered.entities.boss.maxHealth));
    expect(healed.state.phase).toBe(phase);
    expect(healed.events.filter(({ type }) => type === 'phaseChanged')).toEqual([]);
  }
});

test.each(['inactive', 'dead', 'missing'])(
  'phase checks preserve the state of an %s boss', (condition) => {
    const initial = combatEncounter();
    initial.bossActive = condition !== 'inactive';
    initial.entities.boss.health = condition === 'dead' ? 0 : BOSS.maxHealthByPlayerCount[3] * 0.30;
    if (condition === 'missing') delete initial.entities.boss;
    freezeCombat(initial);
    expect(updateBossPhase(initial).state).toBe(initial);
    const result = combatTick(initial);
    expect(result.state.phase).toBe(1);
    expect(result.events).toEqual(condition === 'dead'
      ? [{ type: 'encounterEnded', outcome: 'victory', tick: 1 }] : []);
    expect(result.state.status).toBe(condition === 'dead' ? 'victory' : initial.status);
  },
);

test('phase entry runs after enemy actions and new phase abilities start on the next tick', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.bossAbilityTimers = { obsidianWind: 1 };
  initial.entities.boss.health = BOSS.maxHealthByPlayerCount[3] * 0.65;
  const entered = combatTick(initial);
  expect(entered.events.map((event) => 'abilityId' in event ? event.abilityId : event.type)).toEqual([
    'obsidianWind', 'phaseChanged',
  ]);
  expect(entered.state.phaseElapsedTicks).toBe(0);
  expect(entered.state.bossAbilityTimers).toEqual({
    flayedStrike: 200, obsidianWind: 120, lamentOfTheDead: 280, callOfTheXolos: 0,
  });
  const next = combatTick(entered.state);
  expect(next.state.phaseElapsedTicks).toBe(1);
  expect(next.events).toContainEqual({
    type: 'abilityResolved', sourceId: BOSS.id, abilityId: 'callOfTheXolos', targetId: null, tick: 2,
  });
  expect(next.state.bossAbilityTimers.flayedStrike).toBe(199);
});

test.each([1, 2] as const)(
  'C2: first Strike becomes available and starts at phaseElapsedTicks 200 in phase %s', (phase) => {
    const initial = beforeFirstPhaseTick(phase);
    const before = repeatTick(initial, 199);
    expect(before.state.phaseElapsedTicks).toBe(199);
    expect(before.state.bossAbilityTimers.flayedStrike).toBe(1);
    expect(before.events.filter((event) => 'abilityId' in event && event.abilityId === 'flayedStrike')).toEqual([]);
    const started = combatTick(before.state);
    expect(started.state.phaseElapsedTicks).toBe(200);
    expect(started.events).toContainEqual({
      type: 'castStarted', sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: null,
      durationTicks: 50, tick: initial.tick + 200,
    });
    expect(started.state.bossAbilityTimers.flayedStrike).toBe(BOSS_PHASES[phase].timers.flayedStrike.intervalTicks);
  },
);

test('C2: phase 3 Lament starts at 160, queues Strike at 200 and releases it at 220', () => {
  const initial = beforeFirstPhaseTick(3);
  // Keep every player inside the final safe radius to isolate boss scheduling.
  for (const id of ['p2', 'p3']) Object.assign(initial.entities[id], { x: 12, y: 0 });
  const before = repeatTick(initial, 159);
  expect(before.state.phaseElapsedTicks).toBe(159);
  expect(before.events).toEqual([]);
  const lament = combatTick(before.state);
  expect(lament.state.phaseElapsedTicks).toBe(160);
  expect(lament.events).toEqual([{
    type: 'castStarted', sourceId: BOSS.id, abilityId: 'lamentOfTheDead', targetId: null,
    durationTicks: 60, tick: initial.tick + 160,
  }]);
  const almostDue = repeatTick(lament.state, 39);
  expect(almostDue.state.bossAbilityTimers.flayedStrike).toBe(1);
  expect(almostDue.state.bossAbilityQueue).toEqual([]);
  const due = combatTick(almostDue.state);
  expect(due.state.phaseElapsedTicks).toBe(200);
  expect(due.state.bossAbilityTimers.flayedStrike).toBe(0);
  expect(due.state.bossAbilityQueue).toEqual(['flayedStrike']);
  expect(due.state.entities.boss.cast?.remainingTicks).toBe(20);
  expect(due.events).toEqual([]);
  const waiting = repeatTick(due.state, 19);
  expect(waiting.events).toEqual([]);
  expect(waiting.state.entities.boss.cast?.remainingTicks).toBe(1);
  const strike = combatTick(waiting.state);
  expect(strike.state.phaseElapsedTicks).toBe(220);
  expect(strike.events.map(({ type }) => type)).toEqual(['castFinished', 'abilityResolved', 'damage', 'damage', 'damage', 'castStarted']);
  expect(strike.events.at(-1)).toMatchObject({ abilityId: 'flayedStrike', durationTicks: 50, tick: initial.tick + 220 });
  expect(strike.state.bossAbilityTimers.flayedStrike).toBe(BOSS_PHASES[3].timers.flayedStrike.intervalTicks);
  expect(strike.state.bossAbilityQueue).toEqual([]);
});

test('C3: a Strike spanning a phase change finishes its original cast and deals damage', () => {
  const initial = enemyEncounter('p1', 4.5);
  initial.bossAbilityTimers = { flayedStrike: 1 };
  initial.entities.boss.autoAttackRemainingTicks = 100;
  const started = combatTick(initial);
  expect(started.state.entities.boss.cast?.remainingTicks).toBe(50);
  const entered = combatTick(withBossHealth(started.state, BOSS.maxHealthByPlayerCount[3] * 0.65));
  expect(entered.state.phase).toBe(2);
  expect(entered.state.entities.boss.cast).toMatchObject({ abilityId: 'flayedStrike', remainingTicks: 49, targetId: 'p1' });
  expect(entered.events).toEqual([{ type: 'phaseChanged', phase: 2, tick: 2 }]);
  const waiting = repeatTick(entered.state, 48);
  expect(waiting.state.entities.boss.cast?.remainingTicks).toBe(1);
  expect(waiting.events.filter(({ type }) => type === 'damage' || type === 'castCancelled')).toEqual([]);
  const finished = combatTick(waiting.state);
  // Phase 2 xolos may also attack on this tick; this criterion checks the boss's ongoing cast.
  expect(finished.events.filter((event) => 'sourceId' in event && event.sourceId === BOSS.id)).toEqual([
    { type: 'castFinished', sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', tick: 51 },
    { type: 'abilityResolved', sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', tick: 51 },
    { type: 'damage', sourceId: BOSS.id, abilityId: 'flayedStrike', targetId: 'p1', tick: 51, amount: 280, critical: false },
  ]);
  expect(finished.state.entities.p1.health).toBe(920);
  expect(finished.state.entities.boss.cast).toBeNull();
  expect(finished.state.bossAbilityTimers.flayedStrike).toBe(151);
});

test('C5: entering phase 3 removes Wind and Call timers and empties the old queue', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.phase = 2;
  initial.phaseElapsedTicks = 999;
  initial.bossAbilityTimers = { flayedStrike: 0, obsidianWind: 25, lamentOfTheDead: 0, callOfTheXolos: 80 };
  initial.bossAbilityQueue = ['flayedStrike', 'lamentOfTheDead'];
  initial.entities.boss.health = BOSS.maxHealthByPlayerCount[3] * 0.30;
  initial.entities.boss.cast = {
    abilityId: 'lamentOfTheDead', targetId: null, remainingTicks: 30,
    durationTicks: BOSS_ABILITIES.lamentOfTheDead.castTicks, interruptible: true,
  };
  const before = structuredClone(initial);
  freezeCombat(initial);
  const result = combatTick(initial);
  expect(result.state).toMatchObject({ phase: 3, phaseElapsedTicks: 0, bossAbilityQueue: [] });
  expect(result.state.bossAbilityTimers).toEqual({ flayedStrike: 200, lamentOfTheDead: 160 });
  expect(result.state.entities.boss.cast?.remainingTicks).toBe(29);
  expect(initial).toEqual(before);
  expect(result).toEqual(combatTick(initial));
  for (const id of ['p1', 'p2', 'p3']) expect(result.state.entities[id]).toBe(initial.entities[id]);
});

test('changing only phase state preserves every entity and its active cast by reference', () => {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.entities.boss.health = BOSS.maxHealthByPlayerCount[3] * 0.65;
  initial.entities.boss.cast = {
    abilityId: 'flayedStrike', targetId: 'p1', durationTicks: 50, remainingTicks: 20, interruptible: false,
  };
  freezeCombat(initial);
  const result = updateBossPhase(initial);
  expect(result.state.phase).toBe(2);
  expect(result.state.entities).toBe(initial.entities);
  expect(result.state.entities.boss.cast).toBe(initial.entities.boss.cast);
  expect(updateBossPhase(result.state).state).toBe(result.state);
});
