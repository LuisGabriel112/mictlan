import { advancePlayerAbilities, cancelPlayerCast, usePlayerAbility } from './abilities.js';
import { resolveCombatEffects } from './combat-effects.js';
import type { CombatResult } from './combat-effects.js';
import { BOSS } from './data/boss.js';
import { CLASSES, COMBAT_RULES, PARTY_RULES } from './data/classes.js';
import { createRngState } from './rng.js';
import { displace, normalize } from './movement.js';
import type {
  EncounterConfig,
  EncounterState,
  EnemyEntity,
  Entity,
  Input,
  PlayerCount,
  PlayerEntity,
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

function movePlayer(player: PlayerEntity, input: MoveInput): PlayerEntity {
  if (input.dx === 0 && input.dy === 0) return player;

  const facing = normalize(input.dx, input.dy);
  const distance = player.speedMetersPerSecond / COMBAT_RULES.ticksPerSecond;
  const position = displace(player, facing, distance);
  return { ...player, ...position, facing };
}

type PlayerAbilityResult = ReturnType<typeof usePlayerAbility>;
type PlayerPhase = (player: PlayerEntity, state: EncounterState) => PlayerAbilityResult;

function isSelectableTarget(state: EncounterState, entityId: string | null): boolean {
  return entityId === null || (Object.hasOwn(state.entities, entityId) && state.entities[entityId].health > 0);
}

function selectTargets(player: PlayerEntity, targets: PlayerInputs['targets'], state: EncounterState): PlayerEntity {
  if (player.health <= 0) return player;
  for (const { entityId } of targets) {
    if (isSelectableTarget(state, entityId) && entityId !== player.targetId) player = { ...player, targetId: entityId };
  }
  return player;
}

function isMoving(input: MoveInput | undefined): boolean {
  return input !== undefined && (input.dx !== 0 || input.dy !== 0);
}

function moveAndCancelCast(player: PlayerEntity, input: MoveInput | undefined, tick: number): PlayerAbilityResult {
  if (player.health <= 0 || !input) return { player, events: [] };
  const result = isMoving(input) ? cancelPlayerCast(player, 'moving', tick) : { player, events: [] };
  return { player: movePlayer(result.player, input), events: result.events };
}

function processPlayerInput(player: PlayerEntity, state: EncounterState, input: PlayerInputs | undefined): PlayerAbilityResult {
  if (!input) return { player, events: [] };
  const selected = selectTargets(player, input.targets, state);
  const moved = moveAndCancelCast(selected, input.move, state.tick);
  if (!input.cast) return moved;
  const cast = usePlayerAbility(moved.player, input.cast.abilityId, state.entities, isMoving(input.move), state.tick);
  return { player: cast.player, events: [...moved.events, ...cast.events] };
}

function applyPlayerResult(state: EncounterState, result: PlayerAbilityResult): CombatResult {
  const entities = result.player === state.entities[result.player.id]
    ? state.entities : { ...state.entities, [result.player.id]: result.player };
  return resolveCombatEffects({ ...state, entities }, result.events);
}

function runPlayerPhase(state: EncounterState, phase: PlayerPhase): CombatResult {
  const result: CombatResult = { state, events: [] };
  for (const id of Object.keys(state.entities).sort()) {
    const player = result.state.entities[id];
    if (player.type !== 'player') continue;
    const applied = applyPlayerResult(result.state, phase(player, result.state));
    result.state = applied.state;
    result.events.push(...applied.events);
  }
  return result;
}

export function step(state: EncounterState, inputs: readonly Input[], dtMs: number): CombatResult {
  if (dtMs !== COMBAT_RULES.tickDurationMs) {
    throw new Error(`Cada paso debe durar ${COMBAT_RULES.tickDurationMs} ms.`);
  }
  // Completed casts must affect later validations before any input moves a target.
  const advanced = runPlayerPhase({ ...state, tick: state.tick + 1 }, (player, current) =>
    advancePlayerAbilities(player, current.entities, current.tick));
  const grouped = groupInputs(inputs);
  const processed = runPlayerPhase(advanced.state, (player, current) => processPlayerInput(player, current, grouped.get(player.id)));
  return { state: processed.state, events: [...advanced.events, ...processed.events] };
}
