import { advanceBossAbilities } from '../src/boss.js';
import { advanceEnemy, advanceJaguarAutoAttack } from '../src/enemy.js';
import type { CombatResult } from '../src/combat-effects.js';
import type { EncounterState } from '../src/types.js';
import { combatEncounter, combatTick } from './combat-fixtures.js';
import { threatEnemy } from './threat-fixtures.js';

export function enemyEncounter(targetId = 'p1', centerDistance = 4.5): EncounterState {
  const encounter = combatEncounter();
  encounter.bossActive = true;
  Object.assign(threatEnemy(encounter), { targetId, threat: { [targetId]: 1 } });
  Object.assign(encounter.entities[targetId], { x: centerDistance, y: 0 });
  return encounter;
}

function repeatUpdate(state: EncounterState, ticks: number, update: (state: EncounterState) => CombatResult): CombatResult {
  const result: CombatResult = { state, events: [] };
  for (let elapsed = 0; elapsed < ticks; elapsed += 1) {
    const updated = update(result.state);
    result.state = updated.state;
    result.events.push(...updated.events);
  }
  return result;
}

export function repeatEnemy(state: EncounterState, ticks: number): CombatResult {
  return repeatUpdate(state, ticks, (current) => advanceEnemy(current, 'boss'));
}

export function repeatJaguar(state: EncounterState, ticks: number): CombatResult {
  return repeatUpdate(state, ticks, (current) => advanceJaguarAutoAttack(current, 'p1'));
}

export function repeatBoss(state: EncounterState, ticks: number): CombatResult {
  return repeatUpdate(state, ticks, advanceBossAbilities);
}

export function repeatTick(state: EncounterState, ticks: number): CombatResult {
  return repeatUpdate(state, ticks, combatTick);
}
