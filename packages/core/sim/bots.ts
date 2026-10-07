import { BOSS, CLASSES, COMBAT_RULES, PARTY_RULES, SIMULATION_RULES } from '../src/index.js';
import type {
  Ability, EncounterConfig, EncounterState, EnemyEntity, Entity, Input,
  PlayerAbilityId, PlayerCount, PlayerEntity, Position,
} from '../src/index.js';

export function createBotParty(players: PlayerCount): EncounterConfig['players'] {
  if (!Number.isInteger(players) || players < PARTY_RULES.minPlayers || players > PARTY_RULES.maxPlayers) {
    throw new Error('El simulador requiere entre 3 y 5 jugadores.');
  }
  return Array.from({ length: players }, (_, index) => ({
    id: `player:${index + 1}`,
    classId: index === 0 ? 'jaguar' : index === 1 ? 'healer' : 'eagle',
  }));
}

function distance(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function targetDistance(player: PlayerEntity, target: Entity): number {
  return distance(player, target) - target.bodyRadiusMeters;
}

function direction(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length };
}

function move(player: PlayerEntity, vector: Position): Input[] {
  return [{ playerId: player.id, type: 'move', dx: vector.x, dy: vector.y }];
}

function avoidance(state: EncounterState, player: PlayerEntity): Position | null {
  const zone = [...state.zones]
    .sort((a, b) => a.remainingTicks - b.remainingTicks || compareIds(a, b))
    .find((candidate) => distance(player, candidate)
      <= candidate.radiusMeters + SIMULATION_RULES.dangerMarginMeters);
  const center = COMBAT_RULES.arena.center;
  if (zone) {
    // At the exact mark center, escape toward the arena center; at (0,0), use +X.
    return distance(player, zone) === 0
      ? direction(center.x - player.x, center.y - player.y)
      : direction(player.x - zone.x, player.y - zone.y);
  }
  if (distance(player, center) >= state.safeRadiusMeters - SIMULATION_RULES.dangerMarginMeters) {
    return direction(center.x - player.x, center.y - player.y);
  }
  return null;
}

function positioning(state: EncounterState, player: PlayerEntity, boss: EnemyEntity): Position | null {
  const range = targetDistance(player, boss);
  if (player.classId === 'jaguar') {
    return range > COMBAT_RULES.meleeRangeMeters
      ? direction(boss.x - player.x, boss.y - player.y) : null;
  }
  const offset = range - SIMULATION_RULES.rangedDistanceMeters;
  if (Math.abs(offset) <= SIMULATION_RULES.rangedToleranceMeters) return null;
  const vector = offset > 0
    ? direction(boss.x - player.x, boss.y - player.y)
    : direction(player.x - boss.x, player.y - boss.y);
  const stepDistance = player.speedMetersPerSecond / COMBAT_RULES.ticksPerSecond;
  const next = { x: player.x + vector.x * stepDistance, y: player.y + vector.y * stepDistance };
  // The shrinking arena takes precedence over maintaining ranged distance.
  return distance(next, COMBAT_RULES.arena.center)
    >= state.safeRadiusMeters - SIMULATION_RULES.dangerMarginMeters ? null : vector;
}

function abilityReady(player: PlayerEntity, ability: Ability, target?: Entity): boolean {
  if (ability.triggersGcd && (player.gcdRemainingTicks > 0 || player.cast !== null)) return false;
  if ((player.cooldowns[ability.id] ?? 0) > 0 || player.mana < ability.manaCost) return false;
  if (ability.targetType === 'self' || ability.targetType === 'none') return true;
  return target !== undefined && target.health > 0
    && (ability.rangeMeters === null || targetDistance(player, target) <= ability.rangeMeters);
}

function cast(player: PlayerEntity, id: PlayerAbilityId, target?: Entity): Input[] {
  const ability = CLASSES[player.classId].abilities.find((candidate) => candidate.id === id);
  if (!ability || !abilityReady(player, ability, target)) return [];
  const inputs: Input[] = [];
  if (target) inputs.push({ playerId: player.id, type: 'target', entityId: target.id });
  inputs.push({ playerId: player.id, type: 'cast', abilityId: id });
  return inputs;
}

function tankInputs(state: EncounterState, player: PlayerEntity, boss: EnemyEntity, enemies: EnemyEntity[]): Input[] {
  if (boss.cast?.abilityId === 'flayedStrike' && boss.cast.targetId === player.id) {
    const shield = cast(player, 'obsidianShield');
    if (shield.length > 0) return shield;
  }
  for (const enemy of [boss, ...enemies.filter((enemy) => enemy.type === 'xolo')]) {
    if (enemy.targetId !== null && enemy.targetId !== player.id) {
      const taunt = cast(player, 'taunt', enemy);
      if (taunt.length > 0) return taunt;
    }
  }
  const roarRange = CLASSES.jaguar.abilities[3].rangeMeters;
  if (enemies.some((enemy) => enemy.type === 'xolo' && targetDistance(player, enemy) <= roarRange)) {
    const roar = cast(player, 'roar');
    if (roar.length > 0) return roar;
  }
  return cast(player, 'claw', state.entities[boss.id]);
}

function healthRatio(player: PlayerEntity): number {
  return player.health / player.maxHealth;
}

function healerInputs(player: PlayerEntity, allies: PlayerEntity[]): Input[] {
  const reachable = allies.filter((ally) => targetDistance(player, ally) <= COMBAT_RULES.rangedRangeMeters);
  const byRatio = [...reachable].sort((a, b) => healthRatio(a) - healthRatio(b) || compareIds(a, b));
  const lowest = byRatio[0];
  if (!lowest) return [];
  // Emergency group/single healing precedes maintenance Copal and Remedio.
  if (reachable.filter((ally) => healthRatio(ally) < SIMULATION_RULES.offeringHealthRatio).length
    >= SIMULATION_RULES.offeringMinAllies) {
    const offering = cast(player, 'offering');
    if (offering.length > 0) return offering;
  }
  if (healthRatio(lowest) < SIMULATION_RULES.greatRemedyHealthRatio) {
    const greatRemedy = cast(player, 'greatRemedy', lowest);
    if (greatRemedy.length > 0) return greatRemedy;
  }
  const withoutCopal = reachable.filter((ally) => !ally.auras.some((aura) => aura.definition.id === 'copal'))
    .sort((a, b) => a.health - b.health || compareIds(a, b))[0];
  if (withoutCopal) {
    const copal = cast(player, 'copal', withoutCopal);
    if (copal.length > 0) return copal;
  }
  return healthRatio(lowest) < SIMULATION_RULES.remedyHealthRatio ? cast(player, 'remedy', lowest) : [];
}

function damageInputs(player: PlayerEntity, boss: EnemyEntity, enemies: EnemyEntity[]): Input[] {
  if (boss.cast?.abilityId === 'lamentOfTheDead' && boss.cast.interruptible) {
    const interrupt = cast(player, 'warCry', boss);
    if (interrupt.length > 0) return interrupt;
  }
  const target = enemies.find((enemy) => enemy.type === 'xolo') ?? boss;
  const quickShot = cast(player, 'quickShot', target);
  return quickShot.length > 0 ? quickShot : cast(player, 'obsidianArrow', target);
}

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

/** Read-only policy: every decision uses the same snapshot, with stable ID tie breaks. */
export function getBotInputs(state: EncounterState): Input[] {
  if (state.status !== 'combat') return [];
  const alive = Object.values(state.entities).filter((entity) => entity.health > 0).sort(compareIds);
  const allies = alive.filter((entity): entity is PlayerEntity => entity.type === 'player');
  const enemies = alive.filter((entity): entity is EnemyEntity => entity.type !== 'player');
  const boss = enemies.find((enemy) => enemy.id === BOSS.id);
  if (!boss) return [];
  return allies.flatMap((player): Input[] => {
    const escape = avoidance(state, player);
    if (escape) return move(player, escape);
    const selected: Input[] = player.classId === 'jaguar'
      ? [{ playerId: player.id, type: 'target', entityId: boss.id }] : [];
    // Only the tank approaches before the proximity pull; no healing/attack pulls.
    if (!state.bossActive && player.classId !== 'jaguar') return [];
    const reposition = positioning(state, player, boss);
    if (reposition) return [...selected, ...move(player, reposition)];
    switch (player.classId) {
      case 'jaguar': return [...selected, ...tankInputs(state, player, boss, enemies)];
      case 'healer': return healerInputs(player, allies);
      case 'eagle': return damageInputs(player, boss, enemies);
    }
  });
}
