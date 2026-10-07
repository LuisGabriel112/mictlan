import { BOSS_ABILITIES, XOLO } from '../data/boss.js';
import { COMBAT_RULES } from '../data/classes.js';
import { nextRandom } from '../rng.js';
import { scaledPlayerCount } from '../party.js';
import type { EncounterState, EnemyEntity, PlayerEntity, Position } from '../types.js';

function initialTarget(players: readonly PlayerEntity[], position: Position): PlayerEntity | undefined {
  const healer = players.find((player) => player.classId === XOLO.preferredTargetClassId);
  if (healer) return healer;
  let nearest: PlayerEntity | undefined;
  let nearestDistance = Infinity;
  // Players arrive sorted by id, so equal distances keep the lower id.
  for (const player of players) {
    const distance = Math.hypot(player.x - position.x, player.y - position.y);
    if (distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function createXolo(id: string, position: Position, maxHealth: number, target: PlayerEntity | undefined): EnemyEntity {
  return {
    id, type: BOSS_ABILITIES.callOfTheXolos.effect.entityType, classId: null, ...position,
    health: maxHealth, maxHealth, armorBps: XOLO.armorBps,
    bodyRadiusMeters: XOLO.bodyRadiusMeters, speedMetersPerSecond: XOLO.speedMetersPerSecond,
    targetId: target?.id ?? null, cast: null, auras: [], autoAttackRemainingTicks: 0,
    threat: target ? { [target.id]: XOLO.initialThreat } : {},
    forcedTargetId: null, forcedTargetRemainingTicks: 0,
  };
}

function xoloPosition(angle: number): Position {
  const { center, wallRadiusMeters } = COMBAT_RULES.arena;
  return {
    x: center.x + Math.cos(angle) * wallRadiusMeters,
    y: center.y + Math.sin(angle) * wallRadiusMeters,
  };
}

function addXolo(entities: EncounterState['entities'], players: PlayerEntity[], maxHealth: number, angle: number): void {
  let sequence = 0;
  // Dead enemies remain in entities; skip all occupied ids, including player ids.
  while (Object.hasOwn(entities, `${XOLO.id}:${sequence}`)) sequence += 1;
  const id = `${XOLO.id}:${sequence}`;
  const position = xoloPosition(angle);
  entities[id] = createXolo(id, position, maxHealth, initialTarget(players, position));
}

export function summonXolos(state: EncounterState): EncounterState {
  const players = Object.keys(state.entities).sort().map((id) => state.entities[id])
    .filter((entity): entity is PlayerEntity => entity.type === 'player' && entity.health > 0);
  // Deaths do not change scaling; dev parties use the normal minimum.
  const maxHealth = XOLO.maxHealthByPlayerCount[scaledPlayerCount(state.config.players.length)];
  const { count } = BOSS_ABILITIES.callOfTheXolos.effect;
  const roll = nextRandom(state.rngState);
  const fullTurn = 2 * Math.PI;
  const firstAngle = roll.value * fullTurn;
  const entities = { ...state.entities };
  for (let index = 0; index < count; index += 1) {
    addXolo(entities, players, maxHealth, firstAngle + index * fullTurn / count);
  }
  return { ...state, rngState: roll.rngState, entities };
}
