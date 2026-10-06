import { CLASSES, COMBAT_RULES } from './data/classes.js';
import type {
  Ability,
  AbilityRejectionReason,
  CastCancellationReason,
  CombatEvent,
  Entity,
  PlayerAbilityId,
  PlayerEntity,
} from './types.js';

interface AbilityResult {
  player: PlayerEntity;
  events: CombatEvent[];
}

type TargetRejectionReason = 'invalid_target' | 'out_of_range';
type Entities = Readonly<Record<string, Entity>>;

// Integer costs and mana/second rates use 1/ticksPerSecond mana units.
// Round when entering these units so storing decimal mana never accumulates drift.
function manaUnits(mana: number): number {
  return Math.round(mana * COMBAT_RULES.ticksPerSecond);
}

function regenerateMana(player: PlayerEntity): number {
  const units = manaUnits(player.mana) + CLASSES[player.classId].manaRegenPerSecond;
  return Math.min(units, manaUnits(player.maxMana)) / COMBAT_RULES.ticksPerSecond;
}

function advanceCooldowns(cooldowns: PlayerEntity['cooldowns']): PlayerEntity['cooldowns'] {
  if (!Object.values(cooldowns).some((remaining) => remaining > 0)) return cooldowns;
  return Object.fromEntries(Object.entries(cooldowns)
    .map(([id, remaining]) => [id, Math.max(0, remaining - 1)]));
}

function validateTarget(
  player: PlayerEntity,
  ability: Ability,
  targetId: string | null,
  entities: Entities,
): TargetRejectionReason | null {
  if (ability.targetType === 'self' || ability.targetType === 'none') return null;
  const target = targetId === null ? undefined : entities[targetId];
  if (!target || target.health <= 0) return 'invalid_target';
  const validSide = ability.targetType === 'ally'
    ? target.type === 'player'
    : target.type === 'boss' || target.type === 'xolo';
  if (!validSide) return 'invalid_target';
  if (target.id === player.id) return null;
  const distance = Math.hypot(player.x - target.x, player.y - target.y)
    - target.bodyRadiusMeters;
  return ability.rangeMeters !== null && distance > ability.rangeMeters ? 'out_of_range' : null;
}

function validateAbility(
  player: PlayerEntity,
  ability: Ability,
  entities: Entities,
  moving: boolean,
): AbilityRejectionReason | null {
  if (player.health <= 0) return 'dead';
  if (player.cast !== null && (ability.triggersGcd || ability.castTicks > 0)) return 'casting';
  if (ability.triggersGcd && player.gcdRemainingTicks > 0) return 'gcd';
  if ((player.cooldowns[ability.id] ?? 0) > 0) return 'cooldown';
  if (manaUnits(player.mana) < manaUnits(ability.manaCost)) return 'insufficient_mana';
  const targetRejection = validateTarget(player, ability, player.targetId, entities);
  if (targetRejection !== null) return targetRejection;
  if (ability.castTicks > 0 && moving) return 'moving';
  return null;
}

function resolveAbility(
  player: PlayerEntity,
  ability: Ability,
  targetId: string | null,
  tick: number,
): AbilityResult {
  return {
    player: {
      ...player,
      mana: (manaUnits(player.mana) - manaUnits(ability.manaCost)) / COMBAT_RULES.ticksPerSecond,
      cooldowns: ability.cooldownTicks > 0
        ? { ...player.cooldowns, [ability.id]: ability.cooldownTicks }
        : player.cooldowns,
    },
    events: [{ type: 'abilityResolved', tick, sourceId: player.id, abilityId: ability.id, targetId }],
  };
}

export function cancelPlayerCast(
  player: PlayerEntity,
  reason: CastCancellationReason,
  tick: number,
): AbilityResult {
  if (player.cast === null) return { player, events: [] };
  return {
    player: { ...player, cast: null },
    events: [{ type: 'castCancelled', tick, sourceId: player.id, abilityId: player.cast.abilityId, reason }],
  };
}

function finishPlayerCast(player: PlayerEntity, entities: Entities, tick: number): AbilityResult {
  const cast = player.cast;
  if (cast === null || cast.remainingTicks > 0) return { player, events: [] };
  const ability = CLASSES[player.classId].abilities.find(({ id }) => id === cast.abilityId);
  if (!ability) return { player: { ...player, cast: null }, events: [] };
  const reason = validateTarget(player, ability, cast.targetId, entities);
  if (reason !== null) return cancelPlayerCast(player, reason, tick);
  const result = resolveAbility({ ...player, cast: null }, ability, cast.targetId, tick);
  return {
    player: result.player,
    events: [
      { type: 'castFinished', tick, sourceId: player.id, abilityId: ability.id, targetId: cast.targetId },
      ...result.events,
    ],
  };
}

export function advancePlayerAbilities(player: PlayerEntity, entities: Entities, tick: number): AbilityResult {
  if (player.health <= 0) return { player, events: [] };
  const gcdRemainingTicks = Math.max(0, player.gcdRemainingTicks - 1);
  const cooldowns = advanceCooldowns(player.cooldowns);
  const mana = regenerateMana(player);
  const cast = player.cast === null ? null : {
    ...player.cast, remainingTicks: Math.max(0, player.cast.remainingTicks - 1),
  };
  const advanced = gcdRemainingTicks === player.gcdRemainingTicks
    && cooldowns === player.cooldowns && mana === player.mana && cast === player.cast
    ? player
    : { ...player, gcdRemainingTicks, cooldowns, mana, cast };
  return finishPlayerCast(advanced, entities, tick);
}

export function usePlayerAbility(
  player: PlayerEntity,
  abilityId: PlayerAbilityId,
  entities: Entities,
  moving: boolean,
  tick: number,
): AbilityResult {
  const ability = CLASSES[player.classId].abilities.find(({ id }) => id === abilityId);
  if (!ability) return { player, events: [] };
  const reason = validateAbility(player, ability, entities, moving);
  if (reason !== null) {
    return { player, events: [{ type: 'abilityRejected', tick, sourceId: player.id, abilityId, reason }] };
  }

  const targetId = ability.targetType === 'self' ? player.id
    : ability.targetType === 'none' ? null : player.targetId;
  const started = ability.triggersGcd ? { ...player, gcdRemainingTicks: COMBAT_RULES.gcdTicks } : player;
  if (ability.castTicks === 0) return resolveAbility(started, ability, targetId, tick);
  return {
    player: {
      ...started,
      cast: {
        abilityId, targetId, durationTicks: ability.castTicks,
        remainingTicks: ability.castTicks, interruptible: true,
      },
    },
    events: [{ type: 'castStarted', tick, sourceId: player.id, abilityId, targetId, durationTicks: ability.castTicks }],
  };
}
