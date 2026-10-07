import type { EntitySnapshot } from './snapshot';

// SPEC §8 placeholders: Jaguar orange, Tícitl green, Águila blue, boss purple, xolo gray.
export const ENTITY_COLORS = {
  jaguar: 0xf28c28, healer: 0x3cb44b, eagle: 0x4363d8, boss: 0x7b2cbf, xolo: 0x9e9e9e,
} as const;

export function entityColor({ type, classId }: Pick<EntitySnapshot, 'type' | 'classId'>): number {
  if (type !== 'player') return ENTITY_COLORS[type];
  return ENTITY_COLORS[classId || 'eagle'];
}
