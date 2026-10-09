import { COMBAT_RULES, type Ability, type ClassDefinition } from '@mictlan/core';
import { ABILITY_COPY } from './ability-copy';
import { ABILITY_KEYS } from './keyboard';

const ROLE_NAMES = { tank: 'Tanque', healer: 'Sanador', damage: 'Daño a distancia' } as const;

export function abilityRange(ability: Ability): string {
  if (ability.targetType === 'self') return 'Sobre ti';
  if (ability.effect.type === 'dash') return `Desplazamiento de ${ability.effect.distanceMeters} m`;
  if (ability.rangeMeters === null) return 'Sin alcance';
  return ability.targetType === 'none' ? `Área de ${ability.rangeMeters} m alrededor de ti` : `${ability.rangeMeters} m`;
}

export function abilityHelp(ability: Ability, key: string) {
  return {
    id: ability.id, key, name: ability.name, ...ABILITY_COPY[ability.id],
    cost: ability.manaCost > 0 ? `${ability.manaCost} maná` : 'Sin costo',
    cast: ability.castTicks > 0 ? `${ability.castTicks / COMBAT_RULES.ticksPerSecond} s` : 'instantánea',
    cooldown: `${ability.cooldownTicks / COMBAT_RULES.ticksPerSecond} s`, range: abilityRange(ability),
  };
}

export type AbilityHelp = ReturnType<typeof abilityHelp>;

export function classHelp(definition: ClassDefinition) {
  return {
    name: definition.name, role: ROLE_NAMES[definition.role], health: `Vida: ${definition.maxHealth}`,
    resource: definition.maxMana > 0
      ? `Maná: ${definition.maxMana} · Regeneración: ${definition.manaRegenPerSecond}/s` : 'Sin recurso',
    abilities: definition.abilities.map((ability, index) => abilityHelp(ability, ABILITY_KEYS[index])),
  };
}
