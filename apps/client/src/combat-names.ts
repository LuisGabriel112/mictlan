import { BOSS_ABILITIES, CLASSES } from '@mictlan/core';
import { entityName } from './hud-text';
import type { RoomSnapshot } from './snapshot';

const ABILITY_NAMES: ReadonlyMap<string, string> = new Map([
  ...Object.values(CLASSES).flatMap(({ abilities }) => abilities.map(({ id, name }) => [id, name] as const)),
  ...Object.values(BOSS_ABILITIES).map(({ id, name }) => [id, name] as const),
  ['autoAttack', 'Ataque'], ['unsafeGround', 'Río Apanohuaya'], ['disconnect', 'Desconexión'],
]);

export function abilityName(abilityId: string): string {
  return ABILITY_NAMES.get(abilityId) ?? abilityId;
}

export function combatEntityName(entityId: string, snapshot: RoomSnapshot, selfId: string): string {
  if (entityId === 'environment') return abilityName('unsafeGround');
  const entity = snapshot.entities[entityId];
  return entity ? entityName(entity, selfId) : 'Entidad desconocida';
}
