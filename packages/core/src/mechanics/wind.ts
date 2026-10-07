import { resolveDamageEffect } from '../combat-effects.js';
import type { CombatResult } from '../combat-effects.js';
import { BOSS_ABILITIES } from '../data/boss.js';
import { nextRandom } from '../rng.js';
import type { CombatEvent, DangerZone, EncounterState } from '../types.js';

export function createWindZones(state: EncounterState, sourceId: string): EncounterState {
  const candidates = Object.keys(state.entities).sort().map((id) => state.entities[id])
    .filter((entity) => entity.type === 'player' && entity.health > 0);
  const effect = BOSS_ABILITIES.obsidianWind.effect;
  const count = Math.min(effect.maxTargets, candidates.length);
  if (count === 0) return state;
  const zones: DangerZone[] = [];
  let rngState = state.rngState;
  for (let index = 0; index < count; index += 1) {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    const [target] = candidates.splice(Math.floor(roll.value * candidates.length), 1);
    zones.push({
      id: `${sourceId}:obsidianWind:${state.tick}:${index}`,
      sourceId, abilityId: 'obsidianWind', x: target.x, y: target.y,
      radiusMeters: effect.radiusMeters, remainingTicks: effect.warningTicks, baseDamage: effect.baseDamage,
    });
  }
  return { ...state, rngState, zones: [...state.zones, ...zones] };
}

function explodeWindZone(state: EncounterState, zone: DangerZone): CombatResult {
  const events: CombatEvent[] = [];
  for (const id of Object.keys(state.entities).sort()) {
    const target = state.entities[id];
    if (target.type !== 'player' || target.health <= 0) continue;
    if (Math.hypot(target.x - zone.x, target.y - zone.y) > zone.radiusMeters) continue;
    const result = resolveDamageEffect(state, { ...zone, tick: state.tick }, target, zone.baseDamage);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

export function advanceWindZones(state: EncounterState): CombatResult {
  if (state.zones.length === 0) return { state, events: [] };
  const zones: DangerZone[] = [];
  const events: CombatEvent[] = [];
  for (const zone of state.zones) {
    const remainingTicks = Math.max(0, zone.remainingTicks - 1);
    if (remainingTicks > 0) {
      zones.push({ ...zone, remainingTicks });
    } else {
      const result = explodeWindZone(state, zone);
      state = result.state;
      events.push(...result.events);
    }
  }
  return { state: { ...state, zones }, events };
}
