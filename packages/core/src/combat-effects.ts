import { applyDamage, applyHealing, calculateDamage, calculateHealing, rollCritical } from './combat.js';
import { CLASSES } from './data/classes.js';
import type { Ability, AbilityEffect, CombatEvent, EncounterState, Entity, PlayerEntity } from './types.js';

type DirectEffect = Extract<AbilityEffect, { type: 'damage' | 'areaDamage' | 'heal' | 'areaHeal' }>;
type ResolvedEvent = Extract<CombatEvent, { type: 'abilityResolved' | 'castFinished' }>;

export interface CombatResult {
  state: EncounterState;
  events: CombatEvent[];
}

function isDirectEffect(effect: AbilityEffect): effect is DirectEffect {
  return effect.type === 'damage' || effect.type === 'areaDamage'
    || effect.type === 'heal' || effect.type === 'areaHeal';
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

function resolveTargetEffect(state: EncounterState, event: ResolvedEvent, target: Entity, effect: DirectEffect): CombatResult {
  const roll = rollCritical('player', state.rngState, state.critChance);
  const attribution = { sourceId: event.sourceId, abilityId: event.abilityId, tick: event.tick, critical: roll.critical };
  const result = 'baseDamage' in effect
    ? applyDamage(target, { ...attribution, amount: calculateDamage(effect.baseDamage, target.armorBps, [], roll.critical) })
    : applyHealing(target, {
      ...attribution, amount: calculateHealing(effect.baseHealing, target.health, target.maxHealth, roll.critical).amount,
    });
  const entities = result.entity === target ? state.entities : { ...state.entities, [target.id]: result.entity };
  return { state: { ...state, entities, rngState: roll.rngState }, events: result.events };
}

function livingSource(state: EncounterState, sourceId: string): PlayerEntity | undefined {
  const source = state.entities[sourceId];
  return source?.type === 'player' && source.health > 0 ? source : undefined;
}

function resolveDirectAbility(state: EncounterState, event: ResolvedEvent): CombatResult {
  const source = livingSource(state, event.sourceId);
  if (!source) return { state, events: [] };
  const ability = CLASSES[source.classId].abilities.find(({ id }) => id === event.abilityId);
  if (!ability || !isDirectEffect(ability.effect)) return { state, events: [] };
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
    const result = resolveDirectAbility(state, event);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
