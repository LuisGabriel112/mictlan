import { COMBAT_RULES } from './data/classes.js';
import { nextRandom } from './rng.js';
import type { AbilityId, CombatEvent, Entity } from './types.js';

interface CombatAmount {
  sourceId: string;
  abilityId: AbilityId;
  tick: number;
  amount: number;
  critical: boolean;
}

interface EntityEffectResult {
  entity: Entity;
  events: CombatEvent[];
}

// Integer ratios avoid rounding down an exact result such as 100 * 2900 / 10000.
function scaleAmount(base: number, multipliersBps: readonly number[]): number {
  const scale = BigInt(COMBAT_RULES.basisPointsScale);
  const numerator = multipliersBps.reduce((product, multiplier) => product * BigInt(multiplier), BigInt(base));
  return Number(numerator / scale ** BigInt(multipliersBps.length));
}

function criticalMultiplier(critical: boolean): number {
  return critical ? COMBAT_RULES.criticalMultiplierBps : COMBAT_RULES.basisPointsScale;
}

export function calculateDamage(
  baseDamage: number, armorBps: number, modifiersBps: readonly number[], critical = false,
): number {
  const multipliers = [criticalMultiplier(critical), COMBAT_RULES.basisPointsScale - armorBps, ...modifiersBps];
  return Math.max(COMBAT_RULES.minimumDamage, scaleAmount(baseDamage, multipliers));
}

export function calculateHealing(baseHealing: number, health: number, maxHealth: number, critical = false) {
  const amount = scaleAmount(baseHealing, [criticalMultiplier(critical)]);
  const healedHealth = Math.min(maxHealth, health + amount);
  return { health: healedHealth, amount, effectiveAmount: healedHealth - health };
}

export function rollCritical(sourceType: Entity['type'] | 'environment', rngState: number, critChance: number) {
  if (sourceType !== 'player') return { rngState, critical: false };
  const draw = nextRandom(rngState);
  return { rngState: draw.rngState, critical: draw.value < critChance };
}

export function applyDamage(target: Entity, hit: CombatAmount): EntityEffectResult {
  if (target.health <= 0) return { entity: target, events: [] };
  const health = target.health - hit.amount;
  const entity = { ...target, health, cast: health <= 0 ? null : target.cast };
  const events: CombatEvent[] = [{ type: 'damage', targetId: target.id, ...hit }];
  if (health <= 0) events.push({
    type: 'death', entityId: target.id, tick: hit.tick, sourceId: hit.sourceId, abilityId: hit.abilityId,
  });
  return { entity, events };
}

export function applyHealing(target: Entity, heal: CombatAmount): EntityEffectResult {
  if (target.health <= 0) return { entity: target, events: [] };
  const { health, effectiveAmount } = calculateHealing(heal.amount, target.health, target.maxHealth);
  const entity = effectiveAmount === 0 ? target : { ...target, health };
  return { entity, events: [{ type: 'healing', targetId: target.id, ...heal, effectiveAmount }] };
}
