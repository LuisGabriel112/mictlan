import type { EntitySnapshot, RoomSnapshot } from '../src/snapshot';

export function entity(overrides: Partial<EntitySnapshot> & Pick<EntitySnapshot, 'id'>): EntitySnapshot {
  return {
    type: 'player', classId: 'eagle', x: 0, y: 0, health: 100, maxHealth: 100, mana: 0, maxMana: 0,
    targetId: '', gcdRemainingTicks: 0, cooldowns: {}, auras: {}, ...overrides,
  };
}

export function room(entities: readonly EntitySnapshot[], overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    status: 'combat', code: 'ABCD', tick: 1, phase: 1, safeRadiusMeters: 20, elapsedTicks: 1,
    players: {}, zones: {}, entities: Object.fromEntries(entities.map((item) => [item.id, item])), ...overrides,
  };
}
