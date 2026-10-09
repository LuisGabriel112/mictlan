import type { CombatEvent } from '@mictlan/core';
import { entity, room } from './fixtures';

export function hit(targetId = 'boss', critical = false): CombatEvent {
  return { type: 'damage', tick: 1, sourceId: 'eagle', targetId,
    abilityId: 'quickShot', amount: 70, critical };
}

export function bossRoom() {
  return room([entity({ id: 'eagle', targetId: 'boss', x: 10 }),
    entity({ id: 'boss', type: 'boss', classId: '', x: 2, y: 3 }),
    entity({ id: 'xolo', type: 'xolo', classId: '', x: -10 })]);
}
