import { expect, test } from 'vitest';
import { advanceEnemy, advanceJaguarAutoAttack } from '../src/enemy.js';
import { BOSS, XOLO } from '../src/data/boss.js';
import { CLASSES } from '../src/data/classes.js';
import { applyAura } from '../src/auras.js';
import { nextRandom } from '../src/rng.js';
import { combatEncounter, combatPlayer, freezeCombat } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';
import { enemyEncounter, repeatEnemy, repeatJaguar } from './enemy-fixtures.js';

test('C2: boss pursues at 5 m/s, stops at range and attacks every 40 ticks for 42 on Jaguar', () => {
  const initial = enemyEncounter('p1', 5);
  const chasing = advanceEnemy(initial, BOSS.id);
  expect(chasing.state.entities.boss.x).toBe(0.25);
  expect(chasing.events).toEqual([]);
  const first = advanceEnemy(chasing.state, BOSS.id);
  expect(first.state.entities.boss.x).toBe(0.5);
  expect(first.events[0]).toMatchObject({ type: 'damage', amount: 42, critical: false, abilityId: 'autoAttack' });
  expect(first.state.entities.boss.autoAttackRemainingTicks).toBe(40);
  const waiting = repeatEnemy(first.state, 39);
  expect(waiting.events).toEqual([]);
  expect(waiting.state.entities.boss.autoAttackRemainingTicks).toBe(1);
  expect(advanceEnemy(waiting.state, BOSS.id).events[0]).toMatchObject({ amount: 42 });
});

test('pursuit does not overshoot melee range or move a unit already in range', () => {
  const initial = enemyEncounter('p3', 4.6);
  const result = advanceEnemy(initial, BOSS.id);
  expect(result.state.entities.boss.x).toBeCloseTo(0.1, 12);
  expect(result.state.entities.boss.y).toBe(0);
  expect(result.events[0]).toMatchObject({ amount: 60, targetId: 'p3' });
  expect(advanceEnemy(result.state, BOSS.id).state.entities.boss.x).toBe(result.state.entities.boss.x);
});

test('pursuit normalizes diagonals and clips the enemy center to the wall', () => {
  const initial = enemyEncounter('p3', 30);
  initial.entities.p3.y = 40;
  const diagonal = advanceEnemy(initial, BOSS.id).state.entities.boss;
  expect(diagonal.x).toBeCloseTo(0.15, 12);
  expect(diagonal.y).toBeCloseTo(0.2, 12);
  Object.assign(initial.entities.boss, { x: 12, y: 16 });
  const clipped = advanceEnemy(initial, BOSS.id).state.entities.boss;
  expect(Math.hypot(clipped.x, clipped.y)).toBeLessThanOrEqual(20);
});

test.each([{ x: 6, y: 8 }, { x: -7, y: 9 }, { x: 11, y: -3 }])(
  'diagonal pursuit reaches melee range and attacks at ($x, $y)', ({ x, y }) => {
    const initial = enemyEncounter('p3', x);
    initial.entities.p3.y = y;
    const arrivalTicks = Math.ceil((Math.hypot(x, y) - 4.5) / 0.25);
    const result = repeatEnemy(initial, arrivalTicks);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ amount: 60, targetId: 'p3' });
    const boss = result.state.entities.boss;
    expect(Math.hypot(x - boss.x, y - boss.y) - 0.5).toBeCloseTo(4, 12);
  },
);

test.each([
  { condition: 'inactive', bossActive: false, health: 24000, targetId: 'p1', targetHealth: 1200 },
  { condition: 'dead', bossActive: true, health: 0, targetId: 'p1', targetHealth: 1200 },
  { condition: 'untargeted', bossActive: true, health: 24000, targetId: null, targetHealth: 1200 },
  { condition: 'missing', bossActive: true, health: 24000, targetId: 'missing', targetHealth: 1200 },
  { condition: 'deadTarget', bossActive: true, health: 24000, targetId: 'p1', targetHealth: 0 },
  { condition: 'enemyTarget', bossActive: true, health: 24000, targetId: BOSS.id, targetHealth: 1200 },
])(
  'enemy stays unchanged when $condition', ({ bossActive, health, targetId, targetHealth }) => {
    const initial = enemyEncounter();
    initial.bossActive = bossActive;
    Object.assign(initial.entities.boss, { health, targetId });
    initial.entities.p1.health = targetHealth;
    freezeCombat(initial);
    expect(advanceEnemy(initial, BOSS.id)).toEqual({ state: initial, events: [] });
    expect(advanceEnemy(initial, BOSS.id).state).toBe(initial);
  },
);

test('a casting enemy only advances its attack timer, saturating at zero', () => {
  const initial = enemyEncounter('p1', 10);
  initial.entities.boss.cast = { abilityId: 'flayedStrike', targetId: 'p1', durationTicks: 50, remainingTicks: 20, interruptible: false };
  initial.entities.boss.autoAttackRemainingTicks = 1;
  const result = advanceEnemy(initial, BOSS.id);
  expect(result.events).toEqual([]);
  expect(result.state.entities.boss).toMatchObject({ x: 0, autoAttackRemainingTicks: 0 });
  expect(advanceEnemy(result.state, BOSS.id).state).toBe(result.state);
});

test('an out-of-range timer stays ready and attacks immediately upon entering range', () => {
  const initial = enemyEncounter('p1', 10);
  initial.entities.boss.autoAttackRemainingTicks = 1;
  const ready = repeatEnemy(initial, 2);
  expect(ready.events).toEqual([]);
  expect(ready.state.entities.boss.autoAttackRemainingTicks).toBe(0);
  ready.state.entities.p1.x = ready.state.entities.boss.x + 4.5;
  expect(advanceEnemy(ready.state, BOSS.id).events[0]).toMatchObject({ amount: 42 });
});

test('existing xolos reuse generic AI with their own damage and interval', () => {
  const initial = enemyEncounter('p3', 4.5);
  initial.bossActive = false;
  initial.entities.xolo = { ...threatEnemy(initial), id: 'xolo', type: 'xolo', bodyRadiusMeters: XOLO.bodyRadiusMeters };
  const result = advanceEnemy(initial, 'xolo');
  expect(result.events[0]).toMatchObject({ sourceId: 'xolo', amount: 25, critical: false });
  expect(result.state.entities.xolo.autoAttackRemainingTicks).toBe(30);
  expect(result.state.entities.boss).toBe(initial.entities.boss);
});

test('enemy damage applies Shield, never crits and never consumes RNG', () => {
  const initial = enemyEncounter();
  initial.critChance = 1;
  initial.entities.p1 = applyAura(initial.entities.p1, CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  const result = advanceEnemy(initial, BOSS.id);
  expect(result.events[0]).toMatchObject({ amount: 21, critical: false });
  expect(result.state.rngState).toBe(initial.rngState);
  expect(threatEnemy(result.state).threat).toEqual(threatEnemy(initial).threat);
});

test('C5: Jaguar deals 20 every 40 ticks at the body boundary and generates 60 threat per hit', () => {
  const initial = enemyEncounter('p1', 5.5);
  combatPlayer(initial, 'p1').targetId = BOSS.id;
  const first = advanceJaguarAutoAttack(initial, 'p1');
  expect(first.events[0]).toMatchObject({ sourceId: 'p1', targetId: BOSS.id, abilityId: 'autoAttack', amount: 20 });
  expect(threatEnemy(first.state).threat.p1).toBe(61);
  expect(first.state.entities.p1.autoAttackRemainingTicks).toBe(40);
  const waiting = repeatJaguar(first.state, 39);
  expect(waiting.events).toEqual([]);
  const second = advanceJaguarAutoAttack(waiting.state, 'p1');
  expect(second.events[0]).toMatchObject({ amount: 20 });
  expect(threatEnemy(second.state).threat.p1).toBe(121);
});

test('Jaguar waits at zero outside range and crits using exactly one seeded draw', () => {
  const initial = enemyEncounter('p1', 5.5001);
  initial.critChance = 1;
  combatPlayer(initial, 'p1').targetId = BOSS.id;
  expect(advanceJaguarAutoAttack(initial, 'p1')).toEqual({ state: initial, events: [] });
  initial.entities.p1.x = 5.5;
  const result = advanceJaguarAutoAttack(initial, 'p1');
  expect(result.events[0]).toMatchObject({ amount: 30, critical: true });
  expect(result.state.rngState).toBe(nextRandom(initial.rngState).rngState);
  expect(threatEnemy(result.state).threat.p1).toBe(91);
});

test.each([null, 'missing', 'p2', 'dead'])(
  'Jaguar does not attack invalid target %s', (targetId) => {
    const initial = enemyEncounter();
    initial.entities.dead = { ...threatEnemy(initial), id: 'dead', health: 0 };
    combatPlayer(initial, 'p1').targetId = targetId;
    expect(advanceJaguarAutoAttack(initial, 'p1')).toEqual({ state: initial, events: [] });
  },
);

test.each(['p2', 'p3', BOSS.id, 'missing'])('non-Jaguar %s never auto-attacks', (id) => {
  const initial = enemyEncounter();
  initial.entities.p2.targetId = BOSS.id;
  initial.entities.p3.targetId = BOSS.id;
  expect(advanceJaguarAutoAttack(initial, id)).toEqual({ state: initial, events: [] });
});

test('Jaguar does not act when dead or casting and decrements a waiting timer', () => {
  const initial = enemyEncounter();
  Object.assign(initial.entities.p1, { targetId: BOSS.id, health: 0 });
  expect(advanceJaguarAutoAttack(initial, 'p1').state).toBe(initial);
  initial.entities.p1.health = 1200;
  initial.entities.p1.cast = { abilityId: 'remedy', targetId: 'p1', durationTicks: 30, remainingTicks: 10, interruptible: true };
  initial.entities.p1.autoAttackRemainingTicks = 2;
  const result = advanceJaguarAutoAttack(initial, 'p1');
  expect(result.events).toEqual([]);
  expect(result.state.entities.p1.autoAttackRemainingTicks).toBe(1);
});

test('generic attacks clear a dead target cast and auras while preserving frozen inputs', () => {
  const initial = enemyEncounter();
  initial.entities.p1 = applyAura(initial.entities.p1, CLASSES.jaguar.abilities[2].effect.aura, 'p1', 'obsidianShield');
  initial.entities.p1.health = 21;
  const before = structuredClone(initial);
  freezeCombat(initial);
  const result = advanceEnemy(initial, BOSS.id);
  expect(result.events.at(-1)).toMatchObject({ type: 'death', entityId: 'p1' });
  expect(result.state.entities.p1).toMatchObject({ health: 0, cast: null, auras: [] });
  expect(result.state.entities.p2).toBe(initial.entities.p2);
  expect(initial).toEqual(before);
});

test('generic AI ignores missing ids and players', () => {
  const initial = combatEncounter();
  expect(advanceEnemy(initial, 'missing').state).toBe(initial);
  expect(advanceEnemy(initial, 'p1').state).toBe(initial);
});
