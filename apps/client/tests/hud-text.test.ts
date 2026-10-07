import { expect, test } from 'vitest';
import { latestRejection, rejectionText, selfText, slotLabel, statusText, targetText } from '../src/hud-text';
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

test('target text names the entity and shows its health', () => {
  const snapshot = room([
    entity({ id: 'p1', targetId: 'boss' }),
    entity({ id: 'boss', type: 'boss', classId: '', health: 23860, maxHealth: 24000 }),
    entity({ id: 'x1', type: 'xolo', classId: '', health: 0, maxHealth: 300 }),
    entity({ id: 'p2', classId: 'healer', health: 650, maxHealth: 700 }),
  ]);
  expect(targetText(snapshot, 'p1')).toBe('Objetivo: Mictlantecuhtli, Señor del Mictlán · 23860/24000');
  expect(targetText({ ...snapshot, entities: { ...snapshot.entities, p1: entity({ id: 'p1', targetId: 'x1' }) } }, 'p1'))
    .toBe('Objetivo: Xolo espectral · muerto');
  expect(targetText({ ...snapshot, entities: { ...snapshot.entities, p1: entity({ id: 'p1', targetId: 'p2' }) } }, 'p1'))
    .toBe('Objetivo: Tícitl · 650/700');
  expect(targetText({ ...snapshot, entities: { ...snapshot.entities, p1: entity({ id: 'p1', targetId: 'p1' }) } }, 'p1'))
    .toBe('Objetivo: Guerrero Águila (tú) · 100/100');
  expect(targetText(room([entity({ id: 'p1' })]), 'p1')).toBe('Sin objetivo');
  expect(targetText(room([]), 'p1')).toBe('Sin objetivo');
});

test('self text shows class, health and mana only for casters', () => {
  expect(selfText(room([entity({ id: 'p1', classId: 'healer', health: 600, maxHealth: 700, mana: 812.6, maxMana: 1000 })]), 'p1'))
    .toBe('Tícitl · Vida 600/700 · Maná 812/1000');
  expect(selfText(room([entity({ id: 'p1', classId: 'jaguar', health: 1200, maxHealth: 1200 })]), 'p1'))
    .toBe('Guerrero Jaguar · Vida 1200/1200');
  expect(selfText(room([]), 'p1')).toBe('');
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

test('overkill never shows negative health', () => {
  expect(selfText(room([entity({ id: 'p1', health: -20, maxHealth: 750 })]), 'p1')).toBe('Guerrero Águila · Vida 0/750');
});
