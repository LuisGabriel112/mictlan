import { BOSS } from '../src/data/boss.js';
import type { CombatEvent, EncounterState, EnemyEntity } from '../src/types.js';

export function threatEnemy(state: EncounterState, id: string = BOSS.id): EnemyEntity {
  const enemy = state.entities[id];
  if (!enemy || enemy.type === 'player') throw new Error(`Missing enemy: ${id}`);
  return enemy;
}

export function threatDamage(overrides: Partial<Extract<CombatEvent, { type: 'damage' }>> = {}): CombatEvent {
  return {
    type: 'damage', sourceId: 'p1', targetId: BOSS.id, abilityId: 'claw', amount: 40,
    critical: false, tick: 1, ...overrides,
  };
}

export function threatHealing(overrides: Partial<Extract<CombatEvent, { type: 'healing' }>> = {}): CombatEvent {
  return {
    type: 'healing', sourceId: 'p2', targetId: 'p1', abilityId: 'remedy', amount: 120,
    effectiveAmount: 20, critical: false, tick: 1, ...overrides,
  };
}

export function threatTaunt(targetId: string | null = BOSS.id): Extract<CombatEvent, { type: 'abilityResolved' | 'castFinished' }> {
  return { type: 'abilityResolved', sourceId: 'p1', targetId, abilityId: 'taunt', tick: 1 };
}
