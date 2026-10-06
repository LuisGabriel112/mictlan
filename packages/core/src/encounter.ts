import { advancePlayerAbilities, cancelPlayerCast, usePlayerAbility } from './abilities.js';
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

interface PlayerInputs {
  targets: Extract<Input, { type: 'target' }>[];
  move?: MoveInput;
  cast?: Extract<Input, { type: 'cast' }>;
}

function groupInputs(inputs: readonly Input[]): Map<string, PlayerInputs> {
  const grouped = new Map<string, PlayerInputs>();
  for (const input of inputs) {
    const player = grouped.get(input.playerId) ?? { targets: [] };
    if (input.type === 'target') player.targets.push(input);
    if (input.type === 'move') player.move = input;
    if (input.type === 'cast' && player.cast === undefined) player.cast = input;
    grouped.set(input.playerId, player);
  }
  return grouped;
}

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

  const tick = state.tick + 1;
  const events: CombatEvent[] = [];
  const entities = { ...state.entities };
  const players = Object.values(state.entities)
    .filter((entity) => entity.type === 'player')
    .sort((left, right) => compareIds(left.id, right.id));

  // All timers and completed casts run before any input can move a target.
  for (const player of players) {
    const result = advancePlayerAbilities(player, entities, tick);
    entities[player.id] = result.player;
    events.push(...result.events);
  }

  const grouped = groupInputs(inputs);
  for (const { id } of players) {
    const input = grouped.get(id);
    let player = entities[id];
    if (!input || player.type !== 'player') continue;
    const moving = input.move !== undefined && (input.move.dx !== 0 || input.move.dy !== 0);
    for (const target of input.targets) {
      if (target.entityId === null || Object.hasOwn(entities, target.entityId)) {
        if (target.entityId !== player.targetId) player = { ...player, targetId: target.entityId };
      }
    }
    if (player.health > 0) {
      if (moving) {
        const result = cancelPlayerCast(player, 'moving', tick);
        player = result.player;
        events.push(...result.events);
      }
      if (input.move) player = movePlayer(player, input.move);
    }
    if (input.cast) {
      const result = usePlayerAbility(player, input.cast.abilityId, entities, moving, tick);
      player = result.player;
      events.push(...result.events);
    }
    entities[id] = player;
  }

  return { state: { ...state, entities, tick }, events };
}
