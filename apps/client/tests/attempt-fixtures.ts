import type { CombatEvent } from '@mictlan/core';
import { entity, room } from './fixtures';

export const attemptSnapshot = room([
  entity({ id: 'self', classId: 'eagle' }), entity({ id: 'healer', classId: 'healer' }),
  entity({ id: 'tank', classId: 'jaguar' }), entity({ id: 'boss', type: 'boss', classId: '' }),
  entity({ id: 'xolo', type: 'xolo', classId: '' }),
], { elapsedTicks: 200 });

export const attemptEvents: CombatEvent[] = [
  { type: 'damage', tick: 40, sourceId: 'self', targetId: 'boss', abilityId: 'obsidianArrow', amount: 140, critical: false },
  { type: 'damage', tick: 80, sourceId: 'self', targetId: 'xolo', abilityId: 'quickShot', amount: 105, critical: true },
  { type: 'healing', tick: 80, sourceId: 'healer', targetId: 'tank', abilityId: 'remedy', amount: 180, effectiveAmount: 120, critical: true },
  { type: 'healing', tick: 90, sourceId: 'healer', targetId: 'healer', abilityId: 'copal', amount: 20, effectiveAmount: 10, critical: false },
  { type: 'healing', tick: 100, sourceId: 'healer', targetId: 'tank', abilityId: 'remedy', amount: 120, effectiveAmount: 0, critical: false },
  { type: 'castCancelled', tick: 100, sourceId: 'self', abilityId: 'obsidianArrow', reason: 'moving' },
  { type: 'castCancelled', tick: 110, sourceId: 'self', abilityId: 'obsidianArrow', reason: 'moving' },
  { type: 'castCancelled', tick: 120, sourceId: 'self', abilityId: 'obsidianArrow', reason: 'flight' },
  { type: 'abilityRejected', tick: 130, sourceId: 'self', abilityId: 'quickShot', reason: 'cooldown' },
  { type: 'abilityRejected', tick: 140, sourceId: 'self', abilityId: 'quickShot', reason: 'cooldown' },
  { type: 'abilityRejected', tick: 150, sourceId: 'self', abilityId: 'obsidianArrow', reason: 'out_of_range' },
  { type: 'damage', tick: 160, sourceId: 'boss', targetId: 'self', abilityId: 'autoAttack', amount: 60, critical: false },
  { type: 'damage', tick: 170, sourceId: 'boss', targetId: 'self', abilityId: 'autoAttack', amount: 60, critical: false },
  { type: 'damage', tick: 180, sourceId: 'boss', targetId: 'self', abilityId: 'flayedStrike', amount: 400, critical: false },
  { type: 'damage', tick: 190, sourceId: 'xolo', targetId: 'self', abilityId: 'autoAttack', amount: 25, critical: false },
  { type: 'damage', tick: 200, sourceId: 'environment', targetId: 'self', abilityId: 'unsafeGround', amount: 5, critical: false },
  { type: 'death', tick: 200, sourceId: 'environment', entityId: 'self', abilityId: 'unsafeGround' },
];
