export type ClassId = 'jaguar' | 'healer' | 'eagle';
export type PlayerCount = 3 | 4 | 5;
export type Phase = 1 | 2 | 3;
export type EncounterStatus = 'lobby' | 'combat' | 'victory' | 'defeat';
export type TargetType = 'self' | 'ally' | 'enemy' | 'none';

export type PlayerAbilityId =
  | 'claw'
  | 'taunt'
  | 'obsidianShield'
  | 'roar'
  | 'remedy'
  | 'greatRemedy'
  | 'copal'
  | 'offering'
  | 'obsidianArrow'
  | 'quickShot'
  | 'warCry'
  | 'flight';

export type BossAbilityId =
  | 'flayedStrike'
  | 'obsidianWind'
  | 'lamentOfTheDead'
  | 'callOfTheXolos';

export type AbilityId = PlayerAbilityId | BossAbilityId | 'autoAttack' | 'unsafeGround';

// All *Ticks fields are integer counts of 50 ms ticks. All *Bps fields are
// integer basis points: 10000 is a multiplier of one or a proportion of 100%.
// Positions and distances are in meters; resource amounts may be fractional.
export interface Position {
  x: number;
  y: number;
}

export type AuraDefinition = {
  readonly id: 'obsidianShield';
  readonly name: string;
  readonly type: 'damageTakenMultiplier';
  readonly durationTicks: number;
  readonly multiplierBps: number;
} | {
  readonly id: 'copal';
  readonly name: string;
  readonly type: 'periodicHealing';
  readonly durationTicks: number;
  readonly baseHealing: number;
  readonly intervalTicks: number;
  readonly firstTickDelayTicks: number;
  readonly refreshBehavior: 'resetDurationAndInterval';
  readonly stacks: false;
};

export type AbilityEffect =
  | { readonly type: 'damage'; readonly baseDamage: number }
  | { readonly type: 'heal'; readonly baseHealing: number }
  | { readonly type: 'areaDamage'; readonly baseDamage: number; readonly flatThreat: number }
  | { readonly type: 'areaHeal'; readonly baseHealing: number; readonly includesSelf: true }
  | {
    readonly type: 'taunt';
    readonly durationTicks: number;
    readonly threatMultiplierBps: number;
  }
  | { readonly type: 'applyAura'; readonly aura: AuraDefinition }
  | { readonly type: 'interrupt'; readonly requiresInterruptibleCast: true }
  | {
    readonly type: 'dash';
    readonly distanceMeters: number;
    readonly direction: 'movementOrFacing';
    readonly boundary: 'arenaWall';
    readonly cancelsOwnCast: true;
  };

// Player ability cooldowns are fixed; boss scheduling belongs to phase timers.
export interface Ability {
  readonly id: PlayerAbilityId;
  readonly name: string;
  readonly targetType: TargetType;
  readonly manaCost: number;
  readonly cooldownTicks: number;
  readonly castTicks: number;
  readonly triggersGcd: boolean;
  // Target range or area radius; null for self buffs and displacement.
  readonly rangeMeters: number | null;
  readonly effect: AbilityEffect;
}

export interface AutoAttackDefinition {
  readonly abilityId: 'autoAttack';
  readonly baseDamage: number;
  readonly intervalTicks: number;
  readonly rangeMeters: number;
}

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
  readonly role: 'tank' | 'healer' | 'damage';
  readonly maxHealth: number;
  readonly armorBps: number;
  readonly maxMana: number;
  readonly manaRegenPerSecond: number;
  readonly threatMultiplierBps: number;
  readonly autoAttack: AutoAttackDefinition | null;
  // Action bar order, from slot 1 to slot 4.
  readonly abilities: readonly [Ability, Ability, Ability, Ability];
}

export type BossAbilityEffect =
  | { readonly type: 'damage'; readonly baseDamage: number }
  | { readonly type: 'raidDamage'; readonly baseDamage: number }
  | {
    readonly type: 'wind';
    readonly baseDamage: number;
    readonly radiusMeters: number;
    readonly maxTargets: number;
    readonly warningTicks: number;
    readonly placement: 'fixedTargetPosition';
    readonly overlappingDamage: 'stack';
  }
  | {
    readonly type: 'summon';
    readonly entityType: 'xolo';
    readonly count: number;
    readonly placement: 'oppositeArenaEdges';
  };

export interface BossAbility {
  readonly id: BossAbilityId;
  readonly name: string;
  readonly castTicks: number;
  readonly interruptible: boolean;
  readonly canUseWhileCasting: boolean;
  readonly effect: BossAbilityEffect;
}

export interface PhaseTimer {
  readonly firstTicks: number;
  readonly intervalTicks: number;
}

// An absent entry means the ability is not scheduled in that phase.
export type PhaseTimers = Readonly<Partial<Record<BossAbilityId, PhaseTimer>>>;

export interface BossPhaseDefinition {
  readonly name: string;
  readonly healthThresholdBps: number;
  readonly timers: PhaseTimers;
}

export interface Aura {
  definition: AuraDefinition;
  sourceId: string;
  abilityId: PlayerAbilityId;
  remainingTicks: number;
  ticksUntilNextEffect: number | null;
}

export interface CastState {
  abilityId: PlayerAbilityId | BossAbilityId;
  targetId: string | null;
  durationTicks: number;
  remainingTicks: number;
  interruptible: boolean;
}

interface EntityState extends Position {
  id: string;
  health: number;
  maxHealth: number;
  armorBps: number;
  bodyRadiusMeters: number;
  speedMetersPerSecond: number;
  targetId: string | null;
  cast: CastState | null;
  auras: Aura[];
  autoAttackRemainingTicks: number;
}

export interface PlayerEntity extends EntityState {
  type: 'player';
  classId: ClassId;
  mana: number;
  maxMana: number;
  facing: Position;
  gcdRemainingTicks: number;
  cooldowns: Partial<Record<PlayerAbilityId, number>>;
}

export interface EnemyEntity extends EntityState {
  type: 'boss' | 'xolo';
  classId: null;
  threat: Record<string, number>;
  forcedTargetId: string | null;
  forcedTargetRemainingTicks: number;
}

export type Entity = PlayerEntity | EnemyEntity;

export interface EncounterConfig {
  players: readonly { readonly id: string; readonly classId: ClassId }[];
  critChance?: number;
}

export interface DangerZone extends Position {
  id: string;
  sourceId: string;
  abilityId: 'obsidianWind';
  radiusMeters: number;
  remainingTicks: number;
  baseDamage: number;
}

export interface EncounterState {
  config: EncounterConfig;
  // Unsigned 32-bit RNG state; advancing randomness must return a new state.
  rngState: number;
  entities: Record<string, Entity>;
  zones: DangerZone[];
  status: EncounterStatus;
  tick: number;
  elapsedTicks: number;
  phase: Phase;
  phaseElapsedTicks: number;
  safeRadiusMeters: number;
  critChance: number;
  bossActive: boolean;
  enraged: boolean;
  bossAbilityTimers: Partial<Record<BossAbilityId, number>>;
  bossAbilityQueue: BossAbilityId[];
}

export type Input = { playerId: string } & (
  | { type: 'move'; dx: number; dy: number }
  | { type: 'target'; entityId: string | null }
  | { type: 'cast'; abilityId: PlayerAbilityId }
);

export type AbilityRejectionReason =
  | 'dead'
  | 'casting'
  | 'gcd'
  | 'cooldown'
  | 'insufficient_mana'
  | 'invalid_target'
  | 'out_of_range'
  | 'moving'
  | 'not_casting';

export type CastCancellationReason = 'moving' | 'flight' | 'interrupted';

export type CombatEvent = { tick: number } & (
  | {
    type: 'damage';
    sourceId: string;
    abilityId: AbilityId;
    targetId: string;
    amount: number;
    critical: boolean;
  }
  | {
    type: 'healing';
    sourceId: string;
    abilityId: AbilityId;
    targetId: string;
    amount: number;
    effectiveAmount: number;
    critical: boolean;
  }
  | {
    type: 'castStarted';
    sourceId: string;
    abilityId: PlayerAbilityId | BossAbilityId;
    targetId: string | null;
    durationTicks: number;
  }
  | {
    type: 'castFinished' | 'abilityResolved';
    sourceId: string;
    abilityId: PlayerAbilityId | BossAbilityId;
    targetId: string | null;
  }
  | {
    type: 'castCancelled';
    sourceId: string;
    abilityId: PlayerAbilityId | BossAbilityId;
    reason: CastCancellationReason;
  }
  | {
    type: 'abilityRejected';
    sourceId: string;
    abilityId: PlayerAbilityId;
    reason: AbilityRejectionReason;
  }
  | { type: 'death'; entityId: string }
  | { type: 'phaseChanged'; phase: Phase }
  | { type: 'encounterEnded'; outcome: 'victory' | 'defeat' }
);
