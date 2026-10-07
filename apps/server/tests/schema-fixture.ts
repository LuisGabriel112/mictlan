import { createEncounter, type Aura, type CastState, type DangerZone, type EncounterState } from '@mictlan/core';

export function encounterFixture(): EncounterState {
  return createEncounter({ players: [
    { id: 'tank', classId: 'jaguar' }, { id: 'healer', classId: 'healer' }, { id: 'eagle', classId: 'eagle' },
  ], critChance: 0 }, 42);
}

export function castFixture(overrides: Partial<CastState> = {}): CastState {
  return { abilityId: 'remedy', targetId: 'tank', durationTicks: 30, remainingTicks: 20,
    interruptible: false, ...overrides };
}

export function auraFixture(overrides: Partial<Aura> = {}): Aura {
  return { definition: { id: 'obsidianShield', name: 'Escudo de obsidiana', type: 'damageTakenMultiplier',
    durationTicks: 120, multiplierBps: 5000 }, sourceId: 'tank', abilityId: 'obsidianShield',
  remainingTicks: 100, ticksUntilNextEffect: null, ...overrides };
}

export function zoneFixture(overrides: Partial<DangerZone> = {}): DangerZone {
  return { id: 'wind:1', sourceId: 'boss', abilityId: 'obsidianWind', x: 3, y: -7,
    radiusMeters: 4, remainingTicks: 40, baseDamage: 200, ...overrides };
}

export function activeFixture(): EncounterState {
  const encounter = encounterFixture();
  encounter.entities.healer = { ...encounter.entities.healer, cast: castFixture(), auras: [auraFixture()] };
  encounter.zones = [zoneFixture()];
  return encounter;
}
