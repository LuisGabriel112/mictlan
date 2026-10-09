import { BOSS, BOSS_ABILITIES, BOSS_PHASES, CLASSES, XOLO, type CombatEvent } from '@mictlan/core';
import { entityName } from './hud-text';
import type { RoomSnapshot } from './snapshot';

export const COMBAT_LOG_CAPACITY = 12;
const ABILITY_NAMES: ReadonlyMap<string, string> = new Map([
  ...Object.values(CLASSES).flatMap(({ abilities }) => abilities.map(({ id, name }) => [id, name] as const)),
  ...Object.values(BOSS_ABILITIES).map(({ id, name }) => [id, name] as const),
  ['autoAttack', 'Ataque'], ['unsafeGround', 'Río Apanohuaya'], ['disconnect', 'Desconexión'],
]);

function nameOf(id: string, snapshot: RoomSnapshot, selfId: string): string {
  // Events can precede the schema patch that introduces an enemy.
  if (id === BOSS.id) return BOSS.name.split(',')[0];
  if (id === 'environment') return 'Entorno';
  const entity = snapshot.entities[id];
  if (entity) return entityName(entity, selfId);
  const player = snapshot.players[id];
  if (player?.classId) return `${CLASSES[player.classId].name}${id === selfId ? ' (tú)' : ''}`;
  if (id.startsWith(`${XOLO.id}:`)) return XOLO.name;
  return 'Unidad desconocida';
}

export function combatLogLines(events: readonly CombatEvent[], snapshot: RoomSnapshot, selfId: string): string[] {
  const name = (id: string) => nameOf(id, snapshot, selfId);
  return events.flatMap((event): string[] => {
    switch (event.type) {
      case 'damage':
        return [`${name(event.sourceId)} → ${name(event.targetId)}: ${ABILITY_NAMES.get(event.abilityId)} ${event.amount}${event.critical ? ' (crítico)' : ''}`];
      case 'healing':
        return event.effectiveAmount > 0
          ? [`${name(event.sourceId)} → ${name(event.targetId)}: ${ABILITY_NAMES.get(event.abilityId)} +${event.effectiveAmount}${event.critical ? ' (crítico)' : ''}`] : [];
      case 'death':
        return [`${name(event.entityId)} murió (${ABILITY_NAMES.get(event.abilityId)} · ${name(event.sourceId)})`];
      case 'phaseChanged':
        return [`Fase ${event.phase}: ${BOSS_PHASES[event.phase].name}`];
      case 'enraged':
        return ['¡Enfurecido!'];
      case 'encounterEnded':
        return [event.outcome === 'victory' ? '¡Victoria!' : 'Derrota'];
      case 'castStarted':
        return event.sourceId === BOSS.id
          ? [`${name(event.sourceId)} prepara ${ABILITY_NAMES.get(event.abilityId)}${event.targetId ? ` → ${name(event.targetId)}` : ''}`] : [];
      default:
        // Rejections already have their own notice; resolved casts duplicate damage/healing.
        return [];
    }
  });
}

export function appendCombatLog(previous: readonly string[], incoming: readonly string[]): string[] {
  return [...previous, ...incoming].slice(-COMBAT_LOG_CAPACITY);
}
