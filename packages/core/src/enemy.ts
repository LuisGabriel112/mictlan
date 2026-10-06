import { replaceCombatEntity, resolveDamageEffect } from './combat-effects.js';
import type { CombatResult } from './combat-effects.js';
import { BOSS, XOLO } from './data/boss.js';
import { CLASSES, COMBAT_RULES } from './data/classes.js';
import { displace, normalize } from './movement.js';
import type { AutoAttackDefinition, EncounterState, EnemyEntity, Entity } from './types.js';

function attackTarget(state: EncounterState, source: Entity): Entity | undefined {
  const target = source.targetId === null ? undefined : state.entities[source.targetId];
  if (!target || target.health <= 0) return undefined;
  return (source.type === 'player') !== (target.type === 'player') ? target : undefined;
}

function distanceToTarget(source: Entity, target: Entity): number {
  return Math.hypot(target.x - source.x, target.y - source.y) - target.bodyRadiusMeters;
}

function advanceAttackTimer(source: Entity): Entity {
  const autoAttackRemainingTicks = Math.max(0, source.autoAttackRemainingTicks - 1);
  return autoAttackRemainingTicks === source.autoAttackRemainingTicks ? source : { ...source, autoAttackRemainingTicks };
}

function resolveAutoAttack(state: EncounterState, source: Entity, definition: AutoAttackDefinition): CombatResult {
  const timed = advanceAttackTimer(source);
  state = replaceCombatEntity(state, timed);
  const target = attackTarget(state, timed);
  if (!target || timed.cast !== null || timed.autoAttackRemainingTicks > 0) return { state, events: [] };
  if (distanceToTarget(timed, target) > definition.rangeMeters) return { state, events: [] };
  state = replaceCombatEntity(state, { ...timed, autoAttackRemainingTicks: definition.intervalTicks });
  const event = { sourceId: timed.id, abilityId: definition.abilityId, tick: state.tick };
  return resolveDamageEffect(state, event, target, definition.baseDamage);
}

function pursueTarget(enemy: EnemyEntity, target: Entity): EnemyEntity {
  const gap = distanceToTarget(enemy, target) - COMBAT_RULES.meleeRangeMeters;
  if (enemy.cast !== null || gap <= 0) return enemy;
  const direction = normalize(target.x - enemy.x, target.y - enemy.y);
  const distance = Math.min(gap, enemy.speedMetersPerSecond / COMBAT_RULES.ticksPerSecond);
  const position = displace(enemy, direction, distance);
  return position.x === enemy.x && position.y === enemy.y ? enemy : { ...enemy, ...position };
}

function livingEnemy(state: EncounterState, enemyId: string): EnemyEntity | undefined {
  const enemy = state.entities[enemyId];
  return enemy && enemy.type !== 'player' && enemy.health > 0 ? enemy : undefined;
}

export function advanceEnemy(state: EncounterState, enemyId: string): CombatResult {
  const enemy = livingEnemy(state, enemyId);
  if (!enemy) return { state, events: [] };
  if (enemy.type === 'boss' && !state.bossActive) return { state, events: [] };
  const target = attackTarget(state, enemy);
  if (!target) return { state, events: [] };
  const moved = pursueTarget(enemy, target);
  const definition = enemy.type === 'boss' ? BOSS.autoAttack : XOLO.autoAttack;
  return resolveAutoAttack(replaceCombatEntity(state, moved), moved, definition);
}

export function advanceJaguarAutoAttack(state: EncounterState, playerId: string): CombatResult {
  const player = state.entities[playerId];
  if (!player || player.type !== 'player' || player.health <= 0) return { state, events: [] };
  const definition = CLASSES[player.classId].autoAttack;
  return definition === null ? { state, events: [] } : resolveAutoAttack(state, player, definition);
}
