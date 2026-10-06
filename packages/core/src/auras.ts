import type { Aura, AuraDefinition, Entity, PlayerAbilityId } from './types.js';

export type HealingAura = Aura & { definition: Extract<AuraDefinition, { type: 'periodicHealing' }> };

export function applyAura(target: Entity, definition: AuraDefinition, sourceId: string, abilityId: PlayerAbilityId): Entity {
  if (target.health <= 0) return target;
  const aura: Aura = {
    definition, sourceId, abilityId, remainingTicks: definition.durationTicks,
    ticksUntilNextEffect: definition.type === 'periodicHealing' ? definition.firstTickDelayTicks : null,
  };
  return { ...target, auras: [...target.auras.filter((existing) => existing.definition.id !== definition.id), aura] };
}

export function clearDeadAuras(target: Entity): Entity {
  return target.health <= 0 && target.auras.length > 0 ? { ...target, auras: [] } : target;
}

export function damageTakenModifiers(target: Entity): number[] {
  if (target.health <= 0) return [];
  return target.auras.flatMap(({ definition, remainingTicks }) =>
    definition.type === 'damageTakenMultiplier' && remainingTicks > 0 ? [definition.multiplierBps] : []);
}

function isHealingTick(aura: Aura): aura is HealingAura {
  return aura.definition.type === 'periodicHealing' && aura.remainingTicks > 0 && aura.ticksUntilNextEffect === 1;
}

function advanceAuraClock(aura: Aura): Aura {
  const interval = aura.definition.type === 'periodicHealing' ? aura.definition.intervalTicks : null;
  const countdown = aura.ticksUntilNextEffect === null ? null : aura.ticksUntilNextEffect - 1;
  return { ...aura, remainingTicks: aura.remainingTicks - 1, ticksUntilNextEffect: countdown === 0 ? interval : countdown };
}

export function advanceEntityAuras(target: Entity): { entity: Entity; healingAuras: HealingAura[] } {
  if (target.health <= 0 || target.auras.length === 0) return { entity: clearDeadAuras(target), healingAuras: [] };
  // The final periodic effect belongs to the expiration tick, so collect it before removing the aura.
  const healingAuras = target.auras.filter(isHealingTick);
  const auras = target.auras.map(advanceAuraClock).filter(({ remainingTicks }) => remainingTicks > 0);
  return { entity: { ...target, auras }, healingAuras };
}
