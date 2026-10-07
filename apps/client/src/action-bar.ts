import { CLASSES, COMBAT_RULES, type Ability } from '@mictlan/core';
import { ABILITY_KEYS } from './keyboard';
import { centerDistance, entityRadius, isLiving, type EntitySnapshot, type RoomSnapshot } from './snapshot';

export type SlotState = 'ready' | 'cooldown' | 'gcd' | 'casting' | 'no_mana' | 'no_target' | 'out_of_range' | 'dead';

export interface ActionSlot {
  slot: number;
  key: string;
  abilityId: Ability['id'];
  name: string;
  hasCastTime: boolean;
  state: SlotState;
  cooldownSeconds: number;
}

function matchesTargetSide(ability: Ability, target: EntitySnapshot): boolean {
  return ability.targetType === 'ally' ? target.type === 'player' : target.type !== 'player';
}

function targetState(snapshot: RoomSnapshot, self: EntitySnapshot, ability: Ability): SlotState {
  if (ability.targetType === 'self' || ability.targetType === 'none') return 'ready';
  const target = snapshot.entities[self.targetId];
  if (!target || !isLiving(target) || !matchesTargetSide(ability, target)) return 'no_target';
  const distance = centerDistance(self, target) - entityRadius(target);
  return distance <= (ability.rangeMeters ?? Number.POSITIVE_INFINITY) ? 'ready' : 'out_of_range';
}

// Mirrors the server validation order (SPEC §3) so the bar explains the first failing rule.
function slotState(snapshot: RoomSnapshot, self: EntitySnapshot, ability: Ability, cooldownTicks: number): SlotState {
  if (!isLiving(self)) return 'dead';
  if (self.cast && (ability.triggersGcd || ability.castTicks > 0)) return 'casting';
  if (ability.triggersGcd && self.gcdRemainingTicks > 0) return 'gcd';
  if (cooldownTicks > 0) return 'cooldown';
  if (self.mana < ability.manaCost) return 'no_mana';
  return targetState(snapshot, self, ability);
}

function slotFor(snapshot: RoomSnapshot, self: EntitySnapshot, ability: Ability, index: number): ActionSlot {
  const cooldownTicks = self.cooldowns[ability.id]?.remainingTicks ?? 0;
  return {
    slot: index + 1, key: ABILITY_KEYS[index], abilityId: ability.id, name: ability.name, hasCastTime: ability.castTicks > 0,
    state: slotState(snapshot, self, ability, cooldownTicks),
    cooldownSeconds: cooldownTicks / COMBAT_RULES.ticksPerSecond,
  };
}

export function actionSlots(snapshot: RoomSnapshot, selfId: string): ActionSlot[] {
  const self = snapshot.entities[selfId];
  if (!self || self.type !== 'player' || self.classId === '') return [];
  return CLASSES[self.classId].abilities.map((ability, index) => slotFor(snapshot, self, ability, index));
}
