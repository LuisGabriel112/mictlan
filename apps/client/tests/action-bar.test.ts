import { BOSS } from '@mictlan/core';
import { expect, test } from 'vitest';
import { actionSlots } from '../src/action-bar';
import { entity, room } from './fixtures';

const boss = entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0,
  health: BOSS.maxHealthByPlayerCount[3], maxHealth: BOSS.maxHealthByPlayerCount[3] });

function eagleAt(y: number, overrides = {}) {
  return entity({ id: 'p1', classId: 'eagle', x: 0, y, targetId: 'boss', ...overrides });
}

function states(snapshot: ReturnType<typeof room>, selfId = 'p1') {
  return actionSlots(snapshot, selfId).map(({ state }) => state);
}

test('an eagle in range has its four abilities ready', () => {
  const slots = actionSlots(room([eagleAt(-15), boss]), 'p1');
  expect(slots.map(({ abilityId }) => abilityId)).toEqual(['obsidianArrow', 'quickShot', 'warCry', 'flight']);
  expect(slots.map(({ key }) => key)).toEqual(['1', '2', '3', '4']);
  expect(slots.map(({ state }) => state)).toEqual(['ready', 'ready', 'ready', 'ready']);
  expect(slots[0].name).toBe('Flecha de obsidiana');
  expect(slots.map(({ hasCastTime }) => hasCastTime)).toEqual([true, false, false, false]);
});

test('range subtracts the target body radius', () => {
  expect(states(room([eagleAt(-31.5), boss]))[0]).toBe('ready');
  expect(states(room([eagleAt(-31.6), boss]))[0]).toBe('out_of_range');
});

test('a slot on cooldown reports its remaining seconds', () => {
  const slots = actionSlots(room([eagleAt(-15, { cooldowns: { quickShot: { id: 'quickShot', remainingTicks: 30 } } }), boss]), 'p1');
  expect(slots[1]).toMatchObject({ state: 'cooldown', cooldownSeconds: 1.5 });
  expect(slots[0].cooldownSeconds).toBe(0);
});

test('the GCD blocks GCD abilities but not off-GCD ones', () => {
  expect(states(room([eagleAt(-15, { gcdRemainingTicks: 10 }), boss]))).toEqual(['gcd', 'gcd', 'ready', 'ready']);
});

test('casting blocks everything except off-GCD instants', () => {
  const cast = { abilityId: 'obsidianArrow', targetId: 'boss', durationTicks: 40, remainingTicks: 20, interruptible: false };
  expect(states(room([eagleAt(-15, { cast }), boss]))).toEqual(['casting', 'casting', 'ready', 'ready']);
});

test('enemy abilities without a living enemy target report no target', () => {
  expect(states(room([eagleAt(-15, { targetId: '' }), boss]))).toEqual(['no_target', 'no_target', 'no_target', 'ready']);
  expect(states(room([eagleAt(-15), { ...boss, health: 0 }]))[0]).toBe('no_target');
  expect(states(room([eagleAt(-15, { targetId: 'p1' }), boss]))[1]).toBe('no_target');
});

test('a healer below the mana cost sees out of mana before range', () => {
  const healer = entity({ id: 'p2', classId: 'healer', mana: 39, maxMana: 1000, targetId: 'p2' });
  expect(states(room([healer]), 'p2')).toEqual(['no_mana', 'no_mana', 'no_mana', 'no_mana']);
  const rich = { ...healer, mana: 1000 };
  expect(states(room([rich]), 'p2')).toEqual(['ready', 'ready', 'ready', 'ready']);
});

test('ally abilities reject enemies and accept a living ally in range', () => {
  const healer = entity({ id: 'p2', classId: 'healer', mana: 1000, maxMana: 1000, targetId: 'boss' });
  expect(states(room([healer, boss]), 'p2').slice(0, 3)).toEqual(['no_target', 'no_target', 'no_target']);
  const ally = entity({ id: 'p1', x: 0, y: 40 });
  expect(states(room([{ ...healer, targetId: 'p1' }, ally]), 'p2')[0]).toBe('out_of_range');
});

test('a dead player sees every slot as dead', () => {
  expect(states(room([eagleAt(-15, { health: 0 }), boss]))).toEqual(['dead', 'dead', 'dead', 'dead']);
});

test('a missing self or an enemy self has no action bar', () => {
  expect(actionSlots(room([boss]), 'p1')).toEqual([]);
  expect(actionSlots(room([boss]), 'boss')).toEqual([]);
});

test('self and area abilities ignore the current target', () => {
  const jaguar = entity({ id: 'p1', classId: 'jaguar', targetId: '' });
  expect(states(room([jaguar, boss]))).toEqual(['no_target', 'no_target', 'ready', 'ready']);
});
