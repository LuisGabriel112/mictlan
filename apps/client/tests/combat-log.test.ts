import { BOSS_ABILITIES, CLASSES, type CombatEvent } from '@mictlan/core';
import { expect, test } from 'vitest';
import { abilityName, combatEntityName } from '../src/combat-names';
import { appendCombatLog, combatLogLines } from '../src/combat-log';
import { encounterHeader, formatElapsedTicks, phaseLabel } from '../src/encounter-clock';
import { entity, room } from './fixtures';

const snapshot = room([
  entity({ id: 'boss', type: 'boss', classId: '' }), entity({ id: 'h', classId: 'healer' }),
  entity({ id: 'j', classId: 'jaguar' }), entity({ id: 'x', type: 'xolo', classId: '' }),
]);

test('abilityName reads every core ability and the three special causes', () => {
  const abilities = [...Object.values(CLASSES).flatMap((role) => role.abilities.map(({ id, name }) => ({ id, name }))),
    ...Object.values(BOSS_ABILITIES)];
  for (const ability of abilities) expect(abilityName(ability.id)).toBe(ability.name);
  expect(['autoAttack', 'unsafeGround', 'disconnect'].map(abilityName)).toEqual(['Ataque', 'Río Apanohuaya', 'Desconexión']);
  expect(abilityName('missing')).toBe('missing');
});

test('combatEntityName resolves entities, self, environment and absent entities', () => {
  expect(combatEntityName('h', snapshot, 'h')).toBe('Tícitl (tú)');
  expect(combatEntityName('x', snapshot, 'j')).toBe('Xolo espectral');
  expect(combatEntityName('environment', snapshot, 'j')).toBe('Río Apanohuaya');
  expect(combatEntityName('missing', snapshot, 'j')).toBe('Entidad desconocida');
});

test.each<[CombatEvent, string]>([
  [{ type: 'damage', tick: 1, sourceId: 'boss', targetId: 'h', abilityId: 'flayedStrike', amount: 280, critical: false },
    'Mictlantecuhtli → Tícitl: Golpe del Descarnado 280'],
  [{ type: 'healing', tick: 1, sourceId: 'h', targetId: 'j', abilityId: 'remedy', amount: 180, effectiveAmount: 120, critical: true },
    'Tícitl → Guerrero Jaguar: Remedio +120'],
  [{ type: 'death', tick: 1, sourceId: 'boss', entityId: 'h', abilityId: 'flayedStrike' },
    'Tícitl murió (Mictlantecuhtli: Golpe del Descarnado)'],
  [{ type: 'death', tick: 1, sourceId: 'environment', entityId: 'j', abilityId: 'unsafeGround' },
    'Guerrero Jaguar murió (Río Apanohuaya)'],
  [{ type: 'death', tick: 1, sourceId: 'h', entityId: 'h', abilityId: 'disconnect' },
    'Tícitl murió (Desconexión)'],
  [{ type: 'phaseChanged', tick: 1, phase: 2 }, 'Fase 2: Los guías'],
  [{ type: 'enraged', tick: 1, sourceId: 'boss' }, '¡Enfurecido!'],
  [{ type: 'encounterEnded', tick: 1, outcome: 'victory' }, '¡Victoria!'],
  [{ type: 'encounterEnded', tick: 1, outcome: 'defeat' }, 'Derrota'],
  [{ type: 'castStarted', tick: 1, sourceId: 'boss', abilityId: 'flayedStrike', targetId: 'j', durationTicks: 50 },
    'Mictlantecuhtli prepara Golpe del Descarnado → Guerrero Jaguar'],
  [{ type: 'castStarted', tick: 1, sourceId: 'boss', abilityId: 'lamentOfTheDead', targetId: null, durationTicks: 60 },
    'Mictlantecuhtli prepara Lamento de los muertos'],
])('formats %j', (event, expected) => {
  expect(combatLogLines([event], snapshot, 'other')).toEqual([expected]);
});

test('ignores casts of players, zero healing, rejections and resolution events', () => {
  const events: CombatEvent[] = [
    { type: 'castStarted', tick: 1, sourceId: 'h', abilityId: 'remedy', targetId: 'j', durationTicks: 30 },
    { type: 'healing', tick: 1, sourceId: 'h', targetId: 'j', abilityId: 'remedy', amount: 120, effectiveAmount: 0, critical: false },
    { type: 'abilityRejected', tick: 1, sourceId: 'h', abilityId: 'remedy', reason: 'gcd' },
    { type: 'abilityRejected', tick: 1, sourceId: 'j', abilityId: 'claw', reason: 'dead' },
    { type: 'castFinished', tick: 1, sourceId: 'h', abilityId: 'remedy', targetId: 'j' },
    { type: 'abilityResolved', tick: 1, sourceId: 'h', abilityId: 'remedy', targetId: 'j' },
    { type: 'castCancelled', tick: 1, sourceId: 'h', abilityId: 'remedy', reason: 'moving' },
  ];
  expect(combatLogLines(events, snapshot, 'h')).toEqual([]);
  expect(combatLogLines([], snapshot, 'h')).toEqual([]);
});

test('appendCombatLog retains the last twelve lines in order without mutation', () => {
  const previous = Object.freeze(['old']);
  const incoming = Array.from({ length: 13 }, (_, index) => `${index}`);
  expect(appendCombatLog(previous, incoming)).toEqual(incoming.slice(1));
  expect(appendCombatLog(previous, [])).toEqual(['old']);
  expect(previous).toEqual(['old']);
});

test.each([[0, '00:00'], [19, '00:00'], [20, '00:01'], [1199, '00:59'], [1200, '01:00'], [9600, '08:00'], [120000, '100:00']])(
  'formatElapsedTicks(%i) = %s', (ticks, expected) => expect(formatElapsedTicks(ticks)).toBe(expected),
);

test('phaseLabel and encounterHeader use the current phase and pull clock', () => {
  expect([1, 2, 3].map(phaseLabel)).toEqual(['Fase 1: Los nueve ríos', 'Fase 2: Los guías', 'Fase 3: Río Apanohuaya']);
  expect(phaseLabel(0)).toBe('');
  expect(encounterHeader(room([], { phase: 2, elapsedTicks: 1230 }))).toBe('01:01 · Fase 2: Los guías');
  expect(encounterHeader(room([], { status: 'lobby' }))).toBe('');
});
