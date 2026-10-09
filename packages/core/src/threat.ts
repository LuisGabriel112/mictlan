import { CLASSES, COMBAT_RULES, findPlayerAbility } from './data/classes.js';
import { THREAT_RULES } from './data/threat.js';
import type { AbilityEffect, CombatEvent, EncounterState, EnemyEntity, PlayerEntity } from './types.js';

type DamageEvent = Extract<CombatEvent, { type: 'damage' }>;
type HealingEvent = Extract<CombatEvent, { type: 'healing' }>;
type ResolvedEvent = Extract<CombatEvent, { type: 'abilityResolved' | 'castFinished' }>;
type TauntEffect = Extract<AbilityEffect, { type: 'taunt' }>;
type EnemyTransform = (enemy: EnemyEntity) => EnemyEntity;

function livingPlayer(state: EncounterState, id: string | null): PlayerEntity | undefined {
  const player = id === null ? undefined : state.entities[id];
  return player?.type === 'player' && player.health > 0 ? player : undefined;
}

function enemyTarget(state: EncounterState, id: string | null): EnemyEntity | undefined {
  const target = id === null ? undefined : state.entities[id];
  return target && target.type !== 'player' ? target : undefined;
}

function replaceEnemy(state: EncounterState, enemy: EnemyEntity): EncounterState {
  if (state.entities[enemy.id] === enemy) return state;
  return { ...state, entities: { ...state.entities, [enemy.id]: enemy } };
}

function addThreat(enemy: EnemyEntity, sourceId: string, amount: number): EnemyEntity {
  if (amount === 0) return enemy;
  const threat = { ...enemy.threat, [sourceId]: (enemy.threat[sourceId] ?? 0) + amount };
  return { ...enemy, threat };
}

function livingEnemies(state: EncounterState): EnemyEntity[] {
  return Object.values(state.entities)
    .filter((entity): entity is EnemyEntity => entity.type !== 'player' && entity.health > 0);
}

function transformLivingEnemies(state: EncounterState, transform: EnemyTransform): EncounterState {
  for (const enemy of livingEnemies(state)) state = replaceEnemy(state, transform(enemy));
  return state;
}

function applyDamageThreat(state: EncounterState, source: PlayerEntity, event: DamageEvent): EncounterState {
  const target = enemyTarget(state, event.targetId);
  if (!target) return state;
  const definition = CLASSES[source.classId];
  const effect = definition.abilities.find(({ id }) => id === event.abilityId)?.effect;
  const flatThreat = effect?.type === 'areaDamage' ? effect.flatThreat : 0;
  const amount = event.amount * definition.threatMultiplierBps / COMBAT_RULES.basisPointsScale + flatThreat;
  return replaceEnemy(state, addThreat(target, source.id, amount));
}

function applyHealingThreat(state: EncounterState, source: PlayerEntity, event: HealingEvent): EncounterState {
  const enemies = livingEnemies(state);
  if (enemies.length === 0) return state;
  const amount = event.effectiveAmount * THREAT_RULES.healingMultiplierBps / COMBAT_RULES.basisPointsScale / enemies.length;
  return transformLivingEnemies(state, (enemy) => addThreat(enemy, source.id, amount));
}

function tauntEnemy(state: EncounterState, enemy: EnemyEntity, sourceId: string, effect: TauntEffect): EnemyEntity {
  const highest = highestThreatPlayer(state, enemy);
  const maximum = Math.max(0, highest ? enemy.threat[highest.id] : 0);
  const amount = Math.max(enemy.threat[sourceId] ?? 0, maximum * effect.threatMultiplierBps / COMBAT_RULES.basisPointsScale);
  return {
    ...enemy, threat: { ...enemy.threat, [sourceId]: amount }, targetId: sourceId,
    forcedTargetId: sourceId, forcedTargetRemainingTicks: effect.durationTicks,
  };
}

function applyTauntThreat(state: EncounterState, source: PlayerEntity, event: ResolvedEvent): EncounterState {
  const effect = findPlayerAbility(source.classId, event.abilityId)?.effect;
  if (effect?.type !== 'taunt') return state;
  const enemy = enemyTarget(state, event.targetId);
  if (!enemy || enemy.health <= 0) return state;
  return replaceEnemy(state, tauntEnemy(state, enemy, source.id, effect));
}

export function applyThreatEvent(state: EncounterState, event: CombatEvent): EncounterState {
  if (!('sourceId' in event)) return state;
  const source = livingPlayer(state, event.sourceId);
  if (!source) return state;
  if (event.type === 'damage') return applyDamageThreat(state, source, event);
  if (event.type === 'healing') return applyHealingThreat(state, source, event);
  if (event.type === 'abilityResolved') return applyTauntThreat(state, source, event);
  return state;
}

function advanceForcedTarget(enemy: EnemyEntity): EnemyEntity {
  if (enemy.forcedTargetRemainingTicks === 0) return enemy;
  const remaining = enemy.forcedTargetRemainingTicks - 1;
  return { ...enemy, forcedTargetRemainingTicks: remaining, forcedTargetId: remaining > 0 ? enemy.forcedTargetId : null };
}

export function advanceThreatTimers(state: EncounterState): EncounterState {
  return transformLivingEnemies(state, advanceForcedTarget);
}

function highestThreatPlayer(state: EncounterState, enemy: EnemyEntity): PlayerEntity | undefined {
  let highest: PlayerEntity | undefined;
  for (const id of Object.keys(enemy.threat).sort()) {
    const player = livingPlayer(state, id);
    if (!player) continue;
    if (!highest || enemy.threat[id] > enemy.threat[highest.id]) highest = player;
  }
  return highest;
}

function exceedsSwitchThreshold(enemy: EnemyEntity, current: PlayerEntity, challenger: PlayerEntity): boolean {
  const distance = Math.hypot(challenger.x - enemy.x, challenger.y - enemy.y) - enemy.bodyRadiusMeters;
  const threshold = distance <= COMBAT_RULES.meleeRangeMeters ? THREAT_RULES.meleeSwitchBps : THREAT_RULES.rangedSwitchBps;
  return enemy.threat[challenger.id] * COMBAT_RULES.basisPointsScale > (enemy.threat[current.id] ?? 0) * threshold;
}

function normalTargetId(state: EncounterState, enemy: EnemyEntity): string | null {
  const current = livingPlayer(state, enemy.targetId);
  const challenger = highestThreatPlayer(state, enemy);
  if (!challenger) return current?.id ?? null;
  if (!current) return challenger.id;
  return exceedsSwitchThreshold(enemy, current, challenger) ? challenger.id : current.id;
}

function forcedPlayer(state: EncounterState, enemy: EnemyEntity): PlayerEntity | undefined {
  if (enemy.forcedTargetRemainingTicks <= 0) return undefined;
  return livingPlayer(state, enemy.forcedTargetId);
}

function retargetEnemy(
  enemy: EnemyEntity, targetId: string | null, forcedTargetId: string | null, forcedTargetRemainingTicks: number,
): EnemyEntity {
  const unchanged = targetId === enemy.targetId && forcedTargetId === enemy.forcedTargetId
    && forcedTargetRemainingTicks === enemy.forcedTargetRemainingTicks;
  return unchanged ? enemy : { ...enemy, targetId, forcedTargetId, forcedTargetRemainingTicks };
}

function selectEnemyTarget(state: EncounterState, enemy: EnemyEntity): EnemyEntity {
  const forced = forcedPlayer(state, enemy);
  const forcedTargetId = forced?.id ?? null;
  const forcedTargetRemainingTicks = forced ? enemy.forcedTargetRemainingTicks : 0;
  const targetId = forcedTargetId ?? normalTargetId(state, enemy);
  return retargetEnemy(enemy, targetId, forcedTargetId, forcedTargetRemainingTicks);
}

export function updateEnemyTargets(state: EncounterState): EncounterState {
  return transformLivingEnemies(state, (enemy) => selectEnemyTarget(state, enemy));
}
