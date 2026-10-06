import { BOSS } from './data/boss.js';
import { CLASSES, COMBAT_RULES, PARTY_RULES } from './data/classes.js';
import { createRngState } from './rng.js';
import type {
  CombatEvent,
  EncounterConfig,
  EncounterState,
  EnemyEntity,
  Entity,
  Input,
  PlayerCount,
  PlayerEntity,
  Position,
} from './types.js';

type MoveInput = Extract<Input, { type: 'move' }>;

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlayerCount(count: number): count is PlayerCount {
  return count >= PARTY_RULES.minPlayers && count <= PARTY_RULES.maxPlayers;
}

function normalize(x: number, y: number): Position {
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}

function createPlayer(
  player: EncounterConfig['players'][number],
  index: number,
  playerCount: PlayerCount,
): PlayerEntity {
  const definition = CLASSES[player.classId];
  const x = BOSS.playerSpawn.centerX
    + (index - (playerCount - 1) / 2) * BOSS.playerSpawn.spacingMeters;
  const y = BOSS.playerSpawn.y;

  return {
    id: player.id,
    type: 'player',
    classId: player.classId,
    x,
    y,
    health: definition.maxHealth,
    maxHealth: definition.maxHealth,
    armorBps: definition.armorBps,
    bodyRadiusMeters: COMBAT_RULES.playerBodyRadiusMeters,
    speedMetersPerSecond: COMBAT_RULES.playerSpeedMetersPerSecond,
    mana: definition.maxMana,
    maxMana: definition.maxMana,
    facing: normalize(BOSS.spawn.x - x, BOSS.spawn.y - y),
    targetId: null,
    cast: null,
    auras: [],
    autoAttackRemainingTicks: 0,
    gcdRemainingTicks: 0,
    cooldowns: {},
  };
}

function createBoss(playerCount: PlayerCount): EnemyEntity {
  const maxHealth = BOSS.maxHealthByPlayerCount[playerCount];

  return {
    id: BOSS.id,
    type: 'boss',
    classId: null,
    ...BOSS.spawn,
    health: maxHealth,
    maxHealth,
    armorBps: BOSS.armorBps,
    bodyRadiusMeters: BOSS.bodyRadiusMeters,
    speedMetersPerSecond: BOSS.speedMetersPerSecond,
    targetId: null,
    cast: null,
    auras: [],
    autoAttackRemainingTicks: 0,
    threat: {},
    forcedTargetId: null,
    forcedTargetRemainingTicks: 0,
  };
}

export function createEncounter(config: EncounterConfig, seed: number): EncounterState {
  const playerCount = config.players.length;
  if (!isPlayerCount(playerCount)) {
    throw new Error(
      `El encuentro requiere entre ${PARTY_RULES.minPlayers} y ${PARTY_RULES.maxPlayers} jugadores.`,
    );
  }

  const players = config.players.map((player) => ({ ...player }))
    .sort((left, right) => compareIds(left.id, right.id));
  const entities: Entity[] = [
    createBoss(playerCount),
    ...players.map((player, index) => createPlayer(player, index, playerCount)),
  ];

  return {
    config: { ...config, players },
    rngState: createRngState(seed),
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    zones: [],
    status: 'combat',
    tick: 0,
    elapsedTicks: 0,
    phase: 1,
    phaseElapsedTicks: 0,
    safeRadiusMeters: COMBAT_RULES.arena.initialSafeRadiusMeters,
    critChance: config.critChance ?? COMBAT_RULES.defaultCritChance,
    bossActive: false,
    enraged: false,
    // Pull and phase scheduling are implemented in later tasks.
    bossAbilityTimers: {},
    bossAbilityQueue: [],
  };
}

function clampToWall(position: Position): Position {
  const { center, wallRadiusMeters } = COMBAT_RULES.arena;
  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= wallRadiusMeters) return position;

  // Round inward so floating-point projection cannot leave the center outside.
  const scale = (wallRadiusMeters / distance) * (1 - Number.EPSILON);
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

function movePlayer(player: PlayerEntity, input: MoveInput): PlayerEntity {
  if (input.dx === 0 && input.dy === 0) return player;

  const facing = normalize(input.dx, input.dy);
  const distance = player.speedMetersPerSecond / COMBAT_RULES.ticksPerSecond;
  const position = clampToWall({
    x: player.x + facing.x * distance,
    y: player.y + facing.y * distance,
  });
  return { ...player, ...position, facing };
}

export function step(
  state: EncounterState,
  inputs: readonly Input[],
  dtMs: number,
): { state: EncounterState; events: CombatEvent[] } {
  if (dtMs !== COMBAT_RULES.tickDurationMs) {
    throw new Error(`Cada paso debe durar ${COMBAT_RULES.tickDurationMs} ms.`);
  }

  // Stable sorting preserves arrival order for each player's moves.
  const orderedInputs = [...inputs]
    .sort((left, right) => compareIds(left.playerId, right.playerId));
  const lastMoves = new Map<string, MoveInput>();
  for (const input of orderedInputs) {
    if (input.type === 'move') lastMoves.set(input.playerId, input);
  }

  const entities = { ...state.entities };
  for (const [playerId, input] of lastMoves) {
    const entity = entities[playerId];
    if (entity?.type === 'player') entities[playerId] = movePlayer(entity, input);
  }

  return { state: { ...state, entities, tick: state.tick + 1 }, events: [] };
}
