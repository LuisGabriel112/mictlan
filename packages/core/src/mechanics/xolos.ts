import { BOSS_ABILITIES, XOLO } from '../data/boss.js';
import { COMBAT_RULES } from '../data/classes.js';
import { nextRandom } from '../rng.js';
import type { EncounterState, EnemyEntity, PlayerCount, PlayerEntity, Position } from '../types.js';

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

export function summonXolos(state: EncounterState): EncounterState {
  const players = Object.keys(state.entities).sort().map((id) => state.entities[id])
    .filter((entity): entity is PlayerEntity => entity.type === 'player' && entity.health > 0);
  // createEncounter validates the configured party size; deaths do not change scaling.
  const maxHealth = XOLO.maxHealthByPlayerCount[state.config.players.length as PlayerCount];
  const { count } = BOSS_ABILITIES.callOfTheXolos.effect;
  const roll = nextRandom(state.rngState);
  const fullTurn = 2 * Math.PI;
  const firstAngle = roll.value * fullTurn;
  const { center, wallRadiusMeters } = COMBAT_RULES.arena;
  const entities = { ...state.entities };
  let sequence = 0;
  for (let index = 0; index < count; index += 1) {
    // Dead enemies remain in entities; skip all occupied ids, including player ids.
    while (Object.hasOwn(entities, `${XOLO.id}:${sequence}`)) sequence += 1;
    const id = `${XOLO.id}:${sequence}`;
    const angle = firstAngle + index * fullTurn / count;
    const position = {
      x: center.x + Math.cos(angle) * wallRadiusMeters,
      y: center.y + Math.sin(angle) * wallRadiusMeters,
    };
    entities[id] = createXolo(id, position, maxHealth, initialTarget(players, position));
  }
  return { ...state, rngState: roll.rngState, entities };
}
