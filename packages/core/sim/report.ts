import { BOSS_ABILITIES, CLASSES, COMBAT_RULES } from '../src/index.js';
import type { AbilityId, ClassId, EncounterState } from '../src/index.js';
import type { RunEncounterResult } from './runner.js';

export interface ClassRates {
  classId: ClassId;
  players: number;
  // Per player of the class, averaged over the total combat time of all runs.
  dps: number;
  hps: number;
}

export interface SimulationReport {
  players: number;
  runs: number;
  victoryRate: number;
  averageDurationSeconds: number;
  deathsByAbility: { abilityId: AbilityId; deaths: number }[];
  classRates: ClassRates[];
  averageBossTargetChanges: number;
}

const CLASS_ORDER: readonly ClassId[] = ['jaguar', 'healer', 'eagle'];

function durationSeconds(state: EncounterState): number {
  return state.elapsedTicks / COMBAT_RULES.ticksPerSecond;
}

function classOf(state: EncounterState, entityId: string): ClassId | null {
  const entity = state.entities[entityId];
  return entity?.type === 'player' ? entity.classId : null;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildReport(players: number, results: readonly RunEncounterResult[]): SimulationReport {
  const deaths = new Map<AbilityId, number>();
  const damage = new Map<ClassId, number>();
  const healing = new Map<ClassId, number>();
  const classTime = new Map<ClassId, number>();
  for (const { state, events } of results) {
    const seconds = durationSeconds(state);
    for (const entity of Object.values(state.entities)) {
      if (entity.type === 'player') classTime.set(entity.classId, (classTime.get(entity.classId) ?? 0) + seconds);
    }
    for (const event of events) {
      if (event.type === 'death' && classOf(state, event.entityId) !== null) {
        deaths.set(event.abilityId, (deaths.get(event.abilityId) ?? 0) + 1);
      }
      const sourceClass = 'sourceId' in event ? classOf(state, event.sourceId) : null;
      if (sourceClass === null) continue;
      if (event.type === 'damage') damage.set(sourceClass, (damage.get(sourceClass) ?? 0) + event.amount);
      if (event.type === 'healing') healing.set(sourceClass, (healing.get(sourceClass) ?? 0) + event.effectiveAmount);
    }
  }
  const counts = results[0] ? CLASS_ORDER.map((classId) => ({
    classId,
    players: Object.values(results[0].state.entities)
      .filter((entity) => entity.type === 'player' && entity.classId === classId).length,
  })) : [];
  return {
    players,
    runs: results.length,
    victoryRate: results.length === 0 ? 0
      : results.filter(({ state }) => state.status === 'victory').length / results.length,
    averageDurationSeconds: average(results.map(({ state }) => durationSeconds(state))),
    deathsByAbility: [...deaths].map(([abilityId, count]) => ({ abilityId, deaths: count }))
      .sort((a, b) => b.deaths - a.deaths || (a.abilityId < b.abilityId ? -1 : 1)),
    classRates: counts.filter(({ players: count }) => count > 0).map(({ classId, players: count }) => {
      const time = classTime.get(classId) ?? 0;
      return {
        classId,
        players: count,
        dps: time === 0 ? 0 : (damage.get(classId) ?? 0) / time,
        hps: time === 0 ? 0 : (healing.get(classId) ?? 0) / time,
      };
    }),
    averageBossTargetChanges: average(results.map(({ bossTargetChanges }) => bossTargetChanges)),
  };
}

const EXTRA_ABILITY_NAMES: Partial<Record<AbilityId, string>> = {
  autoAttack: 'Auto-ataque',
  unsafeGround: 'Fuera del radio seguro',
};

export function abilityName(abilityId: AbilityId): string {
  for (const definition of Object.values(CLASSES)) {
    const ability = definition.abilities.find(({ id }) => id === abilityId);
    if (ability) return ability.name;
  }
  const bossAbility = Object.values(BOSS_ABILITIES).find(({ id }) => id === abilityId);
  return bossAbility?.name ?? EXTRA_ABILITY_NAMES[abilityId] ?? abilityId;
}

function formatDuration(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} (${seconds.toFixed(1)} s)`;
}

export function formatReport(report: SimulationReport): string {
  const lines = [
    `=== Simulación: ${report.players} jugadores, ${report.runs} intentos ===`,
    `Victorias:               ${(report.victoryRate * 100).toFixed(1)} %`,
    `Duración media:          ${formatDuration(report.averageDurationSeconds)}`,
    `Cambios de objetivo del jefe (media por intento): ${report.averageBossTargetChanges.toFixed(1)}`,
    '',
    'Muertes de jugadores por habilidad:',
    ...(report.deathsByAbility.length === 0 ? ['  (ninguna)']
      : report.deathsByAbility.map(({ abilityId, deaths }) => `  ${abilityName(abilityId).padEnd(28)} ${deaths}`)),
    '',
    'Por clase (por jugador):  DPS      HPS',
    ...report.classRates.map(({ classId, players, dps, hps }) => `  ${`${CLASSES[classId].name} ×${players}`.padEnd(22)}`
      + ` ${dps.toFixed(1).padStart(7)}  ${hps.toFixed(1).padStart(7)}`),
  ];
  return lines.join('\n');
}
