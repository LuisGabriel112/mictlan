import { replaceCombatEntity, resolveDamageEffect } from './combat-effects.js';
import type { CombatResult } from './combat-effects.js';
import { BOSS, BOSS_ABILITIES, BOSS_PHASES } from './data/boss.js';
import { createPhaseAbilityTimers } from './phases.js';
import { aimCone, insideCone } from './mechanics/cone.js';
import { createWindZones } from './mechanics/wind.js';
import { summonXolos } from './mechanics/xolos.js';
import type { BossAbilityId, CastAim, CombatEvent, EncounterState, EnemyEntity, Entity, PhaseTimers } from './types.js';

function livingBoss(state: EncounterState): EnemyEntity | undefined {
  const boss = state.entities[BOSS.id];
  return boss?.type === 'boss' && boss.health > 0 ? boss : undefined;
}

function isPulled(state: EncounterState, boss: EnemyEntity): boolean {
  return Object.values(state.entities).some((player) => {
    if (player.type !== 'player' || player.health <= 0) return false;
    const distance = Math.hypot(player.x - boss.x, player.y - boss.y) - boss.bodyRadiusMeters;
    return (boss.threat[player.id] ?? 0) > 0 || distance <= BOSS.pullDistanceMeters;
  });
}

// SPEC §4: a pull without threat (by proximity only) aims the boss at the nearest living player.
function pullTarget(state: EncounterState, boss: EnemyEntity): string | null {
  let nearest: { id: string; distance: number } | null = null;
  for (const id of Object.keys(state.entities).sort()) {
    const player = state.entities[id];
    if (player.type !== 'player' || player.health <= 0) continue;
    if ((boss.threat[id] ?? 0) > 0) return boss.targetId;
    const distance = Math.hypot(player.x - boss.x, player.y - boss.y);
    if (!nearest || distance < nearest.distance) nearest = { id, distance };
  }
  return nearest?.id ?? null;
}

export function advanceBossEncounter(state: EncounterState): EncounterState {
  const boss = livingBoss(state);
  if (!boss || (!state.bossActive && !isPulled(state, boss))) return state;
  const bossAbilityTimers = state.bossActive ? state.bossAbilityTimers : createPhaseAbilityTimers(state.phase);
  const advanced = { ...state, bossActive: true, elapsedTicks: state.elapsedTicks + 1,
    phaseElapsedTicks: state.phaseElapsedTicks + 1, bossAbilityTimers };
  if (state.bossActive || boss.targetId !== null) return advanced;
  const targetId = pullTarget(state, boss);
  return targetId === null ? advanced : { ...advanced, entities: { ...state.entities, [boss.id]: { ...boss, targetId } } };
}

type ResolvedEvent = Extract<CombatEvent, { type: 'abilityResolved' | 'castFinished' }>;

function damageLivingPlayers(state: EncounterState, event: ResolvedEvent, baseDamage: number,
  hits: (player: Entity) => boolean): CombatResult {
  const events: CombatEvent[] = [event];
  for (const id of Object.keys(state.entities).sort()) {
    const player = state.entities[id];
    if (player.type !== 'player' || player.health <= 0 || !hits(player)) continue;
    const result = resolveDamageEffect(state, event, player, baseDamage);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

// SPEC §11: the strike hits whoever stands in the cone marked at cast start, not just its target.
function resolveConeStrike(state: EncounterState, event: ResolvedEvent, aim: CastAim | undefined): CombatResult {
  const cone = BOSS_ABILITIES.flayedStrike.effect;
  if (!aim) return { state, events: [event] };
  return damageLivingPlayers(state, event, cone.baseDamage, (player) => insideCone(aim, cone, player, player.bodyRadiusMeters));
}

function resolveBossAbility(state: EncounterState, event: ResolvedEvent, aim?: CastAim): CombatResult {
  if (event.abilityId === 'callOfTheXolos') return { state: summonXolos(state), events: [event] };
  if (event.abilityId === 'obsidianWind') return { state: createWindZones(state, event.sourceId), events: [event] };
  if (event.abilityId === 'lamentOfTheDead') {
    return damageLivingPlayers(state, event, BOSS_ABILITIES.lamentOfTheDead.effect.baseDamage, () => true);
  }
  return event.abilityId === 'flayedStrike' ? resolveConeStrike(state, event, aim) : { state, events: [event] };
}

function advanceBossCast(state: EncounterState, boss: EnemyEntity): CombatResult {
  const cast = boss.cast;
  if (cast === null) return { state, events: [] };
  const remainingTicks = Math.max(0, cast.remainingTicks - 1);
  const advanced = { ...boss, cast: remainingTicks > 0 ? { ...cast, remainingTicks } : null };
  state = replaceCombatEntity(state, advanced);
  if (remainingTicks > 0) return { state, events: [] };
  const attribution = { sourceId: boss.id, abilityId: cast.abilityId, targetId: cast.targetId, tick: state.tick };
  const resolved = resolveBossAbility(state, { type: 'abilityResolved', ...attribution }, cast.aim);
  return { state: resolved.state, events: [{ type: 'castFinished', ...attribution }, ...resolved.events] };
}

function advanceAbilityTimers(state: EncounterState): EncounterState {
  const bossAbilityTimers = { ...state.bossAbilityTimers };
  const bossAbilityQueue = [...state.bossAbilityQueue];
  const timers: PhaseTimers = BOSS_PHASES[state.phase].timers;
  for (const abilityId of Object.keys(timers) as BossAbilityId[]) {
    const remaining = bossAbilityTimers[abilityId];
    if (remaining === undefined) continue;
    bossAbilityTimers[abilityId] = Math.max(0, remaining - 1);
    if (bossAbilityTimers[abilityId] === 0 && !bossAbilityQueue.includes(abilityId)) bossAbilityQueue.push(abilityId);
  }
  return { ...state, bossAbilityTimers, bossAbilityQueue };
}

function startBossAbility(state: EncounterState, boss: EnemyEntity, abilityId: BossAbilityId): CombatResult {
  const ability = BOSS_ABILITIES[abilityId];
  const attribution = { sourceId: boss.id, abilityId, targetId: boss.targetId, tick: state.tick };
  const started: CombatEvent = { type: 'castStarted', ...attribution, durationTicks: ability.castTicks };
  if (ability.castTicks === 0) {
    return resolveBossAbility(state, { type: 'abilityResolved', ...attribution });
  }
  const target = boss.targetId === null ? undefined : state.entities[boss.targetId];
  const aim = ability.effect.type === 'cone' ? { aim: aimCone(boss, target) } : {};
  const cast = { abilityId, targetId: boss.targetId, durationTicks: ability.castTicks,
    remainingTicks: ability.castTicks, interruptible: ability.interruptible, ...aim };
  return { state: replaceCombatEntity(state, { ...boss, cast }), events: [started] };
}

function consumeQueuedAbility(state: EncounterState, abilityId: BossAbilityId, intervalTicks: number): EncounterState {
  return { ...state,
    bossAbilityQueue: state.bossAbilityQueue.filter((queued) => queued !== abilityId),
    bossAbilityTimers: { ...state.bossAbilityTimers, [abilityId]: intervalTicks },
  };
}

function startQueuedAbilities(state: EncounterState): CombatResult {
  const events: CombatEvent[] = [];
  const timers: PhaseTimers = BOSS_PHASES[state.phase].timers;
  for (const abilityId of state.bossAbilityQueue) {
    const boss = livingBoss(state);
    const timer = timers[abilityId];
    if (!boss || !timer) continue;
    if (boss.cast !== null && !BOSS_ABILITIES[abilityId].canUseWhileCasting) continue;
    const ready = consumeQueuedAbility(state, abilityId, timer.intervalTicks);
    const started = startBossAbility(ready, boss, abilityId);
    state = started.state;
    events.push(...started.events);
  }
  return { state, events };
}

export function advanceBossAbilities(state: EncounterState): CombatResult {
  const boss = livingBoss(state);
  if (!state.bossActive || !boss) return { state, events: [] };
  const advanced = advanceBossCast(state, boss);
  const scheduled = startQueuedAbilities(advanceAbilityTimers(advanced.state));
  return { state: scheduled.state, events: [...advanced.events, ...scheduled.events] };
}
