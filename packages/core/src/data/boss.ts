import type {
  AutoAttackDefinition,
  BossAbility,
  BossAbilityId,
  BossPhaseDefinition,
  Phase,
  PlayerCount,
} from '../types.js';
import { COMBAT_RULES } from './classes.js';

export const BOSS_ABILITIES = {
  flayedStrike: {
    id: 'flayedStrike',
    name: 'Golpe del Descarnado',
    castTicks: 50,
    interruptible: false,
    canUseWhileCasting: false,
    effect: { type: 'damage', baseDamage: 400 },
  },
  obsidianWind: {
    id: 'obsidianWind',
    name: 'Viento de obsidiana',
    castTicks: 0,
    interruptible: false,
    canUseWhileCasting: true,
    effect: {
      type: 'wind',
      baseDamage: 200,
      radiusMeters: 4,
      maxTargets: 3,
      warningTicks: 40,
      placement: 'fixedTargetPosition',
      overlappingDamage: 'stack',
    },
  },
  lamentOfTheDead: {
    id: 'lamentOfTheDead',
    name: 'Lamento de los muertos',
    castTicks: 60,
    interruptible: true,
    canUseWhileCasting: false,
    effect: { type: 'raidDamage', baseDamage: 250 },
  },
  callOfTheXolos: {
    id: 'callOfTheXolos',
    name: 'Llamado de los xolos',
    castTicks: 0,
    interruptible: false,
    canUseWhileCasting: true,
    effect: { type: 'summon', entityType: 'xolo', count: 2, placement: 'oppositeArenaEdges' },
  },
} as const satisfies Record<BossAbilityId, BossAbility>;

export const BOSS_PHASES = {
  1: {
    name: 'Los nueve ríos',
    healthThresholdBps: 10000,
    timers: {
      flayedStrike: { firstTicks: 200, intervalTicks: 400 },
      obsidianWind: { firstTicks: 120, intervalTicks: 300 },
      lamentOfTheDead: { firstTicks: 280, intervalTicks: 500 },
    },
  },
  2: {
    name: 'Los guías',
    healthThresholdBps: 6500,
    timers: {
      flayedStrike: { firstTicks: 200, intervalTicks: 400 },
      obsidianWind: { firstTicks: 120, intervalTicks: 240 },
      lamentOfTheDead: { firstTicks: 280, intervalTicks: 500 },
      callOfTheXolos: { firstTicks: 0, intervalTicks: 800 },
    },
  },
  3: {
    name: 'Río Apanohuaya',
    healthThresholdBps: 3000,
    timers: {
      flayedStrike: { firstTicks: 200, intervalTicks: 400 },
      lamentOfTheDead: { firstTicks: 160, intervalTicks: 360 },
    },
  },
} as const satisfies Record<Phase, BossPhaseDefinition>;

export const BOSS = {
  id: 'boss',
  name: 'Mictlantecuhtli, Señor del Mictlán',
  maxHealthByPlayerCount: {
    3: 15000,
    4: 25000,
    5: 35000,
  } satisfies Record<PlayerCount, number>,
  armorBps: 0,
  bodyRadiusMeters: 1.5,
  speedMetersPerSecond: COMBAT_RULES.enemySpeedMetersPerSecond,
  autoAttack: {
    abilityId: 'autoAttack',
    baseDamage: 60,
    intervalTicks: 40,
    rangeMeters: COMBAT_RULES.meleeRangeMeters,
  } satisfies AutoAttackDefinition,
  spawn: { x: 0, y: 0 },
  pullDistanceMeters: 10,
  playerSpawn: { centerX: 0, y: -15, spacingMeters: 2 },
  enrage: {
    afterTicks: 9600,
    damageMultiplierBps: 50000,
    affectedAbilityIds: ['autoAttack', 'flayedStrike', 'lamentOfTheDead', 'obsidianWind'],
  },
  phases: BOSS_PHASES,
  abilities: BOSS_ABILITIES,
  finalPhaseArena: {
    safeRadiusMeters: 12,
    shrinkDurationTicks: 200,
    damagePerTick: 5,
    ignoresArmor: true,
    ignoresAuras: true,
    canCrit: false,
  },
  returnToLobbyDelayTicks: 100,
} as const;

export const XOLO = {
  id: 'xolo',
  name: 'Xolo espectral',
  // SPEC §6: 150 + 150 × (players − 2), for every supported party size.
  maxHealthByPlayerCount: {
    3: 300,
    4: 450,
    5: 600,
  } satisfies Record<PlayerCount, number>,
  armorBps: 0,
  bodyRadiusMeters: 0.5,
  speedMetersPerSecond: COMBAT_RULES.enemySpeedMetersPerSecond,
  autoAttack: {
    abilityId: 'autoAttack',
    baseDamage: 25,
    intervalTicks: 30,
    rangeMeters: COMBAT_RULES.meleeRangeMeters,
  } satisfies AutoAttackDefinition,
  initialThreat: 1,
  preferredTargetClassId: 'healer',
  fallbackTarget: 'nearestLivingPlayer',
} as const;
