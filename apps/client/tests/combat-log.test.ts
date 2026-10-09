import { describe, expect, it } from 'vitest';
import { BOSS_ABILITIES, CLASSES, type AbilityId, type CombatEvent } from '@mictlan/core';
import { appendCombatLog, combatLogLines } from '../src/combat-log';
import { entity, room } from './fixtures';

const snapshot = room([
  entity({ id: 'boss', type: 'boss', classId: '' }),
  entity({ id: 'healer', classId: 'healer', health: 0 }),
  entity({ id: 'tank', classId: 'jaguar' }),
  entity({ id: 'xolo:1', type: 'xolo', classId: '' }),
]);
const damage: CombatEvent = { type: 'damage', tick: 1, sourceId: 'boss', targetId: 'healer', abilityId: 'flayedStrike', amount: 280, critical: false };
const healing: CombatEvent = { type: 'healing', tick: 1, sourceId: 'healer', targetId: 'tank', abilityId: 'remedy', amount: 180, effectiveAmount: 120, critical: false };
const death: CombatEvent = { type: 'death', tick: 1, entityId: 'healer', sourceId: 'boss', abilityId: 'flayedStrike' };
const lines = (events: readonly CombatEvent[], selfId = '') => combatLogLines(events, snapshot, selfId);

describe('combat log', () => {
  it('formats damage and effective healing in Spanish, in event order', () => {
    expect(lines([damage, healing])).toEqual([
      'Mictlantecuhtli → Tícitl: Golpe del Descarnado 280',
      'Tícitl → Guerrero Jaguar: Remedio +120',
    ]);
  });

  it('identifies the victim, lethal ability and caster even after death', () => {
    expect(lines([death], 'healer')).toEqual(['Tícitl (tú) murió (Golpe del Descarnado · Mictlantecuhtli)']);
  });

  it.each([
    ['autoAttack', 'xolo:1', 'Ataque · Xolo espectral'],
    ['unsafeGround', 'environment', 'Río Apanohuaya · Entorno'],
    ['disconnect', 'healer', 'Desconexión · Tícitl'],
  ] as const)('identifies death by %s', (abilityId, sourceId, cause) => {
    expect(lines([{ ...death, abilityId, sourceId }])).toEqual([`Tícitl murió (${cause})`]);
  });

  it('marks critical damage and healing and omits zero effective healing', () => {
    expect(lines([{ ...damage, critical: true }, { ...healing, critical: true }, { ...healing, effectiveAmount: 0 }]))
      .toEqual(['Mictlantecuhtli → Tícitl: Golpe del Descarnado 280 (crítico)',
        'Tícitl → Guerrero Jaguar: Remedio +120 (crítico)']);
  });

  it.each([[1, 'Los nueve ríos'], [2, 'Los guías'], [3, 'Río Apanohuaya']] as const)('names phase %s', (phase, name) => {
    expect(lines([{ type: 'phaseChanged', tick: 1, phase }])).toEqual([`Fase ${phase}: ${name}`]);
  });

  it('formats the existing enraged event', () => {
    expect(lines([{ type: 'enraged', tick: 1, sourceId: 'boss' }])).toEqual(['¡Enfurecido!']);
  });

  it.each([['victory', '¡Victoria!'], ['defeat', 'Derrota']] as const)('formats %s', (outcome, text) => {
    expect(lines([{ type: 'encounterEnded', tick: 1, outcome }])).toEqual([text]);
  });

  it('announces targeted and raid boss casts', () => {
    expect(lines([
      { type: 'castStarted', tick: 1, sourceId: 'boss', abilityId: 'flayedStrike', targetId: 'tank', durationTicks: 50 },
      { type: 'castStarted', tick: 2, sourceId: 'boss', abilityId: 'lamentOfTheDead', targetId: null, durationTicks: 60 },
    ])).toEqual(['Mictlantecuhtli prepara Golpe del Descarnado → Guerrero Jaguar',
      'Mictlantecuhtli prepara Lamento de los muertos']);
  });

  it('does not duplicate rejections, player casts or resolved effects', () => {
    expect(lines([
      { type: 'abilityRejected', tick: 1, sourceId: 'healer', abilityId: 'remedy', reason: 'gcd' },
      { type: 'abilityRejected', tick: 1, sourceId: 'tank', abilityId: 'claw', reason: 'gcd' },
      { type: 'castStarted', tick: 1, sourceId: 'healer', abilityId: 'remedy', targetId: 'tank', durationTicks: 30 },
      { type: 'castFinished', tick: 1, sourceId: 'healer', abilityId: 'remedy', targetId: 'tank' },
      { type: 'abilityResolved', tick: 1, sourceId: 'healer', abilityId: 'remedy', targetId: 'tank' },
      { type: 'castCancelled', tick: 1, sourceId: 'healer', abilityId: 'remedy', reason: 'moving' },
    ], 'healer')).toEqual([]);
  });

  const abilities: readonly { id: AbilityId; name: string }[] = [
    ...Object.values(CLASSES).flatMap(({ abilities }) => abilities.map(({ id, name }) => ({ id, name }))),
    ...Object.values(BOSS_ABILITIES),
    { id: 'autoAttack', name: 'Ataque' }, { id: 'unsafeGround', name: 'Río Apanohuaya' }, { id: 'disconnect', name: 'Desconexión' },
  ];
  it.each(abilities)('uses the Spanish name for $id', ({ id, name }) => {
    expect(lines([{ ...damage, abilityId: id }])[0]).toBe(`Mictlantecuhtli → Tícitl: ${name} 280`);
  });

  it('resolves names before an entity patch, without exposing internal IDs', () => {
    const early = room([], { players: { healer: { id: 'healer', classId: 'healer', ready: true } } });
    expect(combatLogLines([death, { ...damage, sourceId: 'xolo:2' }], early, 'healer')).toEqual([
      'Tícitl (tú) murió (Golpe del Descarnado · Mictlantecuhtli)',
      'Xolo espectral → Tícitl (tú): Golpe del Descarnado 280',
    ]);
    expect(combatLogLines([death], room([]), '')[0]).toContain('Unidad desconocida');
  });

  it('keeps exactly the latest twelve entries without mutating previous lines', () => {
    const previous = Array.from({ length: 12 }, (_, index) => String(index));
    expect(appendCombatLog(previous, ['death', 'defeat'])).toEqual([...previous.slice(2), 'death', 'defeat']);
    expect(previous).toHaveLength(12);
    expect(appendCombatLog([], previous.concat(previous))).toEqual(previous);
  });
});
