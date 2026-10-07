import type { CastState, EncounterState, Entity } from '@mictlan/core';
import { AuraState, CombatCastState, EntityState, ZoneState } from './CombatState.js';
import type { LobbyState } from './LobbyState.js';
import { syncCollection, syncFields } from './projection.js';

function entityFields(entity: Entity) {
  const { id, type, x, y, health, maxHealth } = entity;
  return { id, type, x, y, health, maxHealth,
    classId: entity.classId ?? '', targetId: entity.targetId ?? '',
    mana: entity.type === 'player' ? entity.mana : 0,
    maxMana: entity.type === 'player' ? entity.maxMana : 0 } satisfies Partial<EntityState>;
}

function syncCast(view: EntityState, cast: CastState | null): void {
  if (cast === null) {
    syncFields(view, { cast: undefined });
    return;
  }
  const current = view.cast ?? new CombatCastState();
  syncFields(current, { ...cast, targetId: cast.targetId ?? '' });
  syncFields(view, { cast: current });
}

function syncEntity(view: EntityState, entity: Entity): void {
  syncFields(view, entityFields(entity));
  syncCast(view, entity.cast);
  const auras = entity.auras.map(({ definition, sourceId, remainingTicks }) => ({
    id: definition.id, sourceId, remainingTicks,
  }));
  syncCollection(view.auras, auras, () => new AuraState(), syncFields);
}

export function syncEncounter(view: LobbyState, encounter: EncounterState): void {
  const { status, phase, safeRadiusMeters, elapsedTicks, tick } = encounter;
  syncFields(view, { status, phase, safeRadiusMeters, elapsedTicks, tick });
  syncCollection(view.entities, Object.values(encounter.entities), () => new EntityState(), syncEntity);
  const zones = encounter.zones.map(({ id, x, y, radiusMeters, remainingTicks }) => ({
    id, x, y, radiusMeters, remainingTicks,
  }));
  syncCollection(view.zones, zones, () => new ZoneState(), syncFields);
}

export function resetLobby(view: LobbyState): void {
  view.entities.clear();
  view.zones.clear();
  syncFields(view, { status: 'lobby', phase: 0, safeRadiusMeters: 0, elapsedTicks: 0, tick: 0 });
  for (const player of view.players.values()) player.ready = false;
}
