import { applyDamage, applyHealing, calculateDamage, calculateHealing, rollCritical } from './combat.js';
import { advanceEntityAuras, applyAura, clearDeadAuras, damageTakenModifiers } from './auras.js';
import type { HealingAura } from './auras.js';
import { CLASSES } from './data/classes.js';
import { applyThreatEvent } from './threat.js';
import type { Ability, AbilityEffect, CombatEvent, EncounterState, Entity, PlayerEntity } from './types.js';

type TargetEffect = Extract<AbilityEffect, { type: 'damage' | 'areaDamage' | 'heal' | 'areaHeal' | 'applyAura' }>;
type ResolvedEvent = Extract<CombatEvent, { type: 'abilityResolved' | 'castFinished' }>;
type EffectAttribution = Pick<Extract<CombatEvent, { type: 'damage' }>, 'sourceId' | 'abilityId' | 'tick'>;

export interface CombatResult {
  state: EncounterState;
  events: CombatEvent[];
}

function isTargetEffect(effect: AbilityEffect): effect is TargetEffect {
  return effect.type === 'damage' || effect.type === 'areaDamage'
    || effect.type === 'heal' || effect.type === 'areaHeal' || effect.type === 'applyAura';
}

function areaTargets(state: EncounterState, source: PlayerEntity, ability: Ability): Entity[] {
  const healsPlayers = ability.effect.type === 'areaHeal';
  return Object.keys(state.entities).sort().map((id) => state.entities[id]).filter((target) => {
    const sameSide = (target.type === 'player') === healsPlayers;
    const distance = Math.hypot(source.x - target.x, source.y - target.y) - target.bodyRadiusMeters;
    return target.health > 0 && sameSide && distance <= (ability.rangeMeters ?? 0);
  });
}

function effectTargets(state: EncounterState, source: PlayerEntity, ability: Ability, targetId: string | null): Entity[] {
  if (ability.targetType === 'none') return areaTargets(state, source, ability);
  const target = targetId === null ? undefined : state.entities[targetId];
  return target && target.health > 0 ? [target] : [];
}

export function replaceCombatEntity(state: EncounterState, entity: Entity): EncounterState {
  const cleaned = clearDeadAuras(entity);
  return cleaned === state.entities[entity.id] ? state : { ...state, entities: { ...state.entities, [entity.id]: cleaned } };
}

function applyEntityEffect(state: EncounterState, result: ReturnType<typeof applyDamage>, rngState: number): CombatResult {
  const updated = replaceCombatEntity(state, result.entity);
  const threatened = result.events.reduce(applyThreatEvent, { ...updated, rngState });
  return { state: threatened, events: result.events };
}

export function resolveDamageEffect(state: EncounterState, event: EffectAttribution, target: Entity, baseDamage: number): CombatResult {
  const roll = rollCritical(state.entities[event.sourceId].type, state.rngState, state.critChance);
  const amount = calculateDamage(baseDamage, target.armorBps, damageTakenModifiers(target), roll.critical);
  const attribution = { sourceId: event.sourceId, abilityId: event.abilityId, tick: event.tick };
  const result = applyDamage(target, { ...attribution, amount, critical: roll.critical });
  return applyEntityEffect(state, result, roll.rngState);
}

function resolveTargetEffect(state: EncounterState, event: EffectAttribution, target: Entity, effect: TargetEffect): CombatResult {
  if (effect.type === 'applyAura') {
    const entity = applyAura(target, effect.aura, event.sourceId, effect.aura.id);
    return { state: replaceCombatEntity(state, entity), events: [] };
  }
  if ('baseDamage' in effect) return resolveDamageEffect(state, event, target, effect.baseDamage);
  const roll = rollCritical('player', state.rngState, state.critChance);
  const attribution = { sourceId: event.sourceId, abilityId: event.abilityId, tick: event.tick, critical: roll.critical };
  const result = applyHealing(target, {
    ...attribution, amount: calculateHealing(effect.baseHealing, target.health, target.maxHealth, roll.critical).amount,
  });
  return applyEntityEffect(state, result, roll.rngState);
}

function livingSource(state: EncounterState, sourceId: string): PlayerEntity | undefined {
  const source = state.entities[sourceId];
  return source?.type === 'player' && source.health > 0 ? source : undefined;
}

function resolveAbilityEffects(state: EncounterState, event: ResolvedEvent): CombatResult {
  const source = livingSource(state, event.sourceId);
  if (!source) return { state, events: [] };
  const ability = CLASSES[source.classId].abilities.find(({ id }) => id === event.abilityId);
  if (!ability || !isTargetEffect(ability.effect)) return { state, events: [] };
  const events: CombatEvent[] = [];
  for (const target of effectTargets(state, source, ability, event.targetId)) {
    const result = resolveTargetEffect(state, event, target, ability.effect);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

export function resolveCombatEffects(state: EncounterState, abilityEvents: readonly CombatEvent[]): CombatResult {
  const events: CombatEvent[] = [];
  for (const event of abilityEvents) {
    events.push(event);
    if (event.type !== 'abilityResolved') continue;
    state = applyThreatEvent(state, event);
    const result = resolveAbilityEffects(state, event);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

function resolveAuraHealing(state: EncounterState, targetId: string, auras: readonly HealingAura[]): CombatResult {
  const events: CombatEvent[] = [];
  for (const aura of auras) {
    const attribution = { sourceId: aura.sourceId, abilityId: aura.abilityId, tick: state.tick };
    const effect = { type: 'heal', baseHealing: aura.definition.baseHealing } as const;
    const result = resolveTargetEffect(state, attribution, state.entities[targetId], effect);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

export function advanceAuraEffects(state: EncounterState): CombatResult {
  const events: CombatEvent[] = [];
  for (const id of Object.keys(state.entities).sort()) {
    const advanced = advanceEntityAuras(state.entities[id]);
    state = replaceCombatEntity(state, advanced.entity);
    const result = resolveAuraHealing(state, id, advanced.healingAuras);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
