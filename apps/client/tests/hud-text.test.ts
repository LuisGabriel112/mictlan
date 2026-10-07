import { expect, test } from 'vitest';
import { entityName, latestRejection, rejectionText, slotLabel, statusText } from '../src/hud-text';
import { entity, room } from './fixtures';

test.each([
  ['gcd', 'Aún no está lista'], ['cooldown', 'En recarga'], ['insufficient_mana', 'Sin maná'],
  ['invalid_target', 'Objetivo inválido'], ['out_of_range', 'Fuera de alcance'],
  ['moving', 'No puedes castear en movimiento'], ['casting', 'Ya estás casteando'], ['dead', 'Estás muerto'],
  ['not_casting', 'El objetivo no está casteando'], ['unknown', 'No se puede usar'],
])('rejection %s reads "%s"', (reason, text) => {
  expect(rejectionText(reason)).toBe(text);
});

test.each([
  ['lobby', 'Esperando jugadores · Código ABCD'], ['combat', ''], ['victory', '¡Victoria!'], ['defeat', 'Derrota'],
] as const)('status %s reads "%s"', (status, text) => {
  expect(statusText(room([], { status }))).toBe(text);
});

test.each([
  [{ state: 'ready', cooldownSeconds: 0 }, { caption: '', tint: 0xffffff }],
  [{ state: 'cooldown', cooldownSeconds: 1.25 }, { caption: '1.3', tint: 0x666666 }],
  [{ state: 'gcd', cooldownSeconds: 0 }, { caption: '', tint: 0x888888 }],
  [{ state: 'casting', cooldownSeconds: 0 }, { caption: '', tint: 0x888888 }],
  [{ state: 'no_mana', cooldownSeconds: 0 }, { caption: 'Sin maná', tint: 0x5577ff }],
  [{ state: 'out_of_range', cooldownSeconds: 0 }, { caption: 'Lejos', tint: 0xff5555 }],
  [{ state: 'no_target', cooldownSeconds: 0 }, { caption: 'Sin objetivo', tint: 0x888888 }],
  [{ state: 'dead', cooldownSeconds: 0 }, { caption: '', tint: 0x444444 }],
] as const)('slot %j is labeled %j', (slot, label) => {
  expect(slotLabel(slot)).toEqual(label);
});

test('entity names come from core data and mark the local player', () => {
  expect(entityName(entity({ id: 'boss', type: 'boss', classId: '' }), 'p1')).toBe('Mictlantecuhtli, Señor del Mictlán');
  expect(entityName(entity({ id: 'x1', type: 'xolo', classId: '' }), 'p1')).toBe('Xolo espectral');
  expect(entityName(entity({ id: 'p2', classId: 'healer' }), 'p1')).toBe('Tícitl');
  expect(entityName(entity({ id: 'p1' }), 'p1')).toBe('Guerrero Águila (tú)');
  expect(entityName(entity({ id: 'p3', classId: '' }), 'p1')).toBe('');
});

test('the latest rejection of the local player is reported, others are ignored', () => {
  const events = [
    { type: 'abilityRejected', tick: 1, sourceId: 'p1', abilityId: 'claw', reason: 'gcd' },
    { type: 'abilityRejected', tick: 1, sourceId: 'p2', abilityId: 'claw', reason: 'dead' },
    { type: 'abilityRejected', tick: 2, sourceId: 'p1', abilityId: 'claw', reason: 'out_of_range' },
    { type: 'death', tick: 2, entityId: 'p3', sourceId: 'boss', abilityId: 'autoAttack' },
  ] as const;
  expect(latestRejection(events, 'p1')).toBe('out_of_range');
  expect(latestRejection(events, 'p9')).toBeUndefined();
  expect(latestRejection([], 'p1')).toBeUndefined();
});
