import { expect, test } from 'vitest';
import { usePlayerAbility } from '../src/abilities.js';
import { advanceBossAbilities } from '../src/boss.js';
import { BOSS, BOSS_ABILITIES, BOSS_PHASES } from '../src/data/boss.js';
import { CLASSES } from '../src/data/classes.js';
import { interruptCast } from '../src/mechanics/interrupt.js';
import type { AbilityRejectionReason, BossAbilityId, EncounterState, PlayerEntity } from '../src/types.js';
import { combatCast, combatEncounter, combatPlayer, combatTick, freezeCombat, muteAutoAttack } from './combat-fixtures.js';
import { repeatTick } from './enemy-fixtures.js';

const lament = BOSS_ABILITIES.lamentOfTheDead;
const warCry = CLASSES.eagle.abilities[2];

function startLament(): EncounterState {
  const initial = combatEncounter();
  initial.bossActive = true;
  initial.bossAbilityTimers = { lamentOfTheDead: 1 };
  combatPlayer(initial).targetId = BOSS.id;
  muteAutoAttack(initial, 'p3');
  return combatTick(initial).state;
}

test('C3: uninterrupted Lament deals 250 to every living player, 175 to Jaguar', () => {
  const initial = startLament();
  initial.entities.dead = { ...initial.entities.p3, id: 'dead', health: 0 };
  // Raid damage must not depend on the selected target or its range.
  Object.assign(initial.entities.p2, { x: 0, y: 20 });
  freezeCombat(initial);
  const waiting = repeatTick(initial, lament.castTicks - 1);
  expect(waiting.events).toEqual([]);
  const result = combatTick(waiting.state);
  expect(result.events.filter((event) => event.type === 'damage')).toEqual([
    { type: 'damage', tick: initial.tick + lament.castTicks, sourceId: BOSS.id,
      abilityId: lament.id, targetId: 'p1', amount: 175, critical: false },
    { type: 'damage', tick: initial.tick + lament.castTicks, sourceId: BOSS.id,
      abilityId: lament.id, targetId: 'p2', amount: 250, critical: false },
    { type: 'damage', tick: initial.tick + lament.castTicks, sourceId: BOSS.id,
      abilityId: lament.id, targetId: 'p3', amount: 250, critical: false },
  ]);
  expect(result.state.entities.dead).toBe(initial.entities.dead);
  expect(result.state.rngState).toBe(initial.rngState);
});

test('C3: War Cry cancels Lament without damage, emits interrupted and spends its cooldown', () => {
  const initial = startLament();
  freezeCombat(initial);
  const result = combatTick(initial, [combatCast('warCry')]);
  expect(result.events).toEqual([
    { type: 'abilityResolved', tick: 2, sourceId: 'p3', abilityId: 'warCry', targetId: BOSS.id },
    { type: 'castCancelled', tick: 2, sourceId: BOSS.id, abilityId: lament.id, reason: 'interrupted' },
  ]);
  expect(result.state.entities.boss.cast).toBeNull();
  expect(combatPlayer(result.state)).toMatchObject({ cooldowns: { warCry: warCry.cooldownTicks }, gcdRemainingTicks: 0 });
  const after = repeatTick(result.state, lament.castTicks);
  expect(after.events).toEqual([]);
  for (const id of ['p1', 'p2', 'p3']) expect(after.state.entities[id].health).toBe(initial.entities[id].health);
  expect(result.state.entities.p1).toBe(initial.entities.p1);
  expect(result.state.entities.p2).toBe(initial.entities.p2);
  expect(initial.entities.boss.cast).not.toBeNull();
});

test('interruption preserves the next Lament deadline counted from its original start', () => {
  const initial = startLament();
  const interrupted = combatTick(initial, [combatCast('warCry')]);
  const interval = BOSS_PHASES[1].timers.lamentOfTheDead.intervalTicks;
  expect(interrupted.state.bossAbilityTimers.lamentOfTheDead).toBe(interval - 1);
  const waiting = repeatTick(interrupted.state, interval - 2);
  expect(waiting.events).toEqual([]);
  const restarted = combatTick(waiting.state);
  expect(restarted.events).toContainEqual({ type: 'castStarted', tick: initial.tick + interval,
    sourceId: BOSS.id, abilityId: lament.id, targetId: null, durationTicks: lament.castTicks });
});

test.each([null, 'flayedStrike'] satisfies (BossAbilityId | null)[])(
  'C4: War Cry rejects %s with not_casting and no cooldown', (abilityId) => {
    const initial = combatEncounter();
    combatPlayer(initial).targetId = BOSS.id;
    muteAutoAttack(initial, 'p3');
    if (abilityId !== null) {
      const ability = BOSS_ABILITIES[abilityId];
      initial.entities.boss.cast = { abilityId, targetId: 'p1', interruptible: ability.interruptible,
        durationTicks: ability.castTicks, remainingTicks: ability.castTicks };
    }
    freezeCombat(initial);
    const result = combatTick(initial, [combatCast('warCry')]);
    expect(result.events).toEqual([{ type: 'abilityRejected', tick: 1, sourceId: 'p3',
      abilityId: 'warCry', reason: 'not_casting' }]);
    expect(combatPlayer(result.state).cooldowns.warCry).toBeUndefined();
    // Only the muted SPEC §11 auto-attack timer ticks; the rejection itself leaves the player untouched.
    expect(result.state.entities.p3).toEqual({ ...initial.entities.p3, autoAttackRemainingTicks: expect.any(Number) });
    expect(result.state.entities.boss).toBe(initial.entities.boss);
  },
);

test.each([
  { reason: 'dead', overrides: { health: 0, cooldowns: { warCry: 5 }, targetId: null } },
  { reason: 'cooldown', overrides: { cooldowns: { warCry: 5 }, targetId: null } },
  { reason: 'invalid_target', overrides: { targetId: null } },
  { reason: 'invalid_target', overrides: { targetId: 'p1' } },
  { reason: 'out_of_range', overrides: { x: 40, y: 0 } },
] satisfies { reason: AbilityRejectionReason; overrides: Partial<PlayerEntity> }[])(
  '$reason validation precedes the interruptible-cast check', ({ reason, overrides }) => {
    const initial = combatEncounter();
    const player = { ...combatPlayer(initial), targetId: BOSS.id, ...overrides };
    const result = usePlayerAbility(player, 'warCry', initial.entities, true, initial.tick);
    expect(result.events).toEqual([{ type: 'abilityRejected', tick: initial.tick,
      sourceId: player.id, abilityId: 'warCry', reason }]);
    expect(result.player).toBe(player);
  },
);

test('War Cry can interrupt on the last cast tick while moving, casting and on GCD', () => {
  const initial = startLament();
  initial.entities.boss.cast = { abilityId: lament.id, targetId: null, durationTicks: lament.castTicks,
    remainingTicks: 1, interruptible: true };
  const arrow = CLASSES.eagle.abilities[0];
  combatPlayer(initial).cast = { abilityId: arrow.id, targetId: BOSS.id, durationTicks: arrow.castTicks,
    remainingTicks: arrow.castTicks, interruptible: false };
  combatPlayer(initial).gcdRemainingTicks = 10;
  const result = combatTick(initial, [combatCast('warCry')]);
  expect(result.state.entities.boss.cast).toBeNull();
  expect(combatPlayer(result.state).cast?.abilityId).toBe(arrow.id);
  expect(combatPlayer(result.state).gcdRemainingTicks).toBe(9);
  expect(result.events.some((event) => event.type === 'damage')).toBe(false);
  const moving = combatTick(initial, [{ type: 'move', playerId: 'p3', dx: 1, dy: 0 }, combatCast('warCry')]);
  expect(moving.events).toContainEqual({ type: 'castCancelled', tick: 2, sourceId: BOSS.id,
    abilityId: lament.id, reason: 'interrupted' });
});

test('two War Cries in one tick cancel once; the second player does not spend cooldown', () => {
  const initial = startLament();
  initial.entities.p4 = { ...combatPlayer(initial), id: 'p4' };
  const result = combatTick(initial, [combatCast('warCry', 'p4'), combatCast('warCry', 'p3')]);
  expect(result.events.filter((event) => event.type === 'castCancelled')).toHaveLength(1);
  expect(result.events).toContainEqual({ type: 'abilityRejected', tick: 2, sourceId: 'p4',
    abilityId: 'warCry', reason: 'not_casting' });
  expect(combatPlayer(result.state, 'p4').cooldowns.warCry).toBeUndefined();
});

test.each([
  { playerId: 'p2', abilityId: 'remedy', targetId: 'p1' },
  { playerId: 'p2', abilityId: 'greatRemedy', targetId: 'p1' },
  { playerId: 'p3', abilityId: 'obsidianArrow', targetId: BOSS.id },
] as const)('player cast $abilityId is not interruptible', ({ playerId, abilityId, targetId }) => {
  const initial = combatEncounter();
  combatPlayer(initial, playerId).targetId = targetId;
  const result = combatTick(initial, [combatCast(abilityId, playerId)]);
  expect(result.state.entities[playerId].cast).toMatchObject({ abilityId, interruptible: false });
  expect(interruptCast(result.state, playerId).state).toBe(result.state);
});

test('Lament uses armor, real Shield and enrage with a single final rounding', () => {
  const shielded = combatTick(combatEncounter(), [combatCast('obsidianShield', 'p1')]).state;
  const initial = { ...shielded, bossActive: true, enraged: true, bossAbilityTimers: { lamentOfTheDead: 1 } };
  const started = advanceBossAbilities(initial).state;
  const result = repeatTick(started, lament.castTicks);
  expect(result.events).toContainEqual({ type: 'damage', tick: initial.tick + lament.castTicks,
    sourceId: BOSS.id, abilityId: lament.id, targetId: 'p1', amount: 437, critical: false });
});
