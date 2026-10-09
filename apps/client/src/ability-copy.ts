import type { PlayerAbilityId } from '@mictlan/core';

export type AbilityKind = 'daño' | 'cura' | 'defensa' | 'control' | 'movilidad';
export const ABILITY_COPY: Record<PlayerAbilityId, { type: AbilityKind; description: string }> = {
  claw: { type: 'daño', description: 'Golpea a tu enemigo seleccionado cuerpo a cuerpo.' },
  taunt: { type: 'control', description: 'Obliga al enemigo seleccionado a atacarte y aumenta tu amenaza.' },
  obsidianShield: { type: 'defensa', description: 'Reduce temporalmente el daño que recibes; úsalo antes de un golpe fuerte.' },
  roar: { type: 'control', description: 'Daña y genera amenaza sobre los enemigos a tu alrededor.' },
  remedy: { type: 'cura', description: 'Cura al aliado seleccionado tras un casteo corto.' },
  greatRemedy: { type: 'cura', description: 'Cura mucho al aliado seleccionado, pero requiere un casteo largo.' },
  copal: { type: 'cura', description: 'Cura periódicamente al aliado seleccionado; renovarlo no acumula su efecto.' },
  offering: { type: 'cura', description: 'Cura a los aliados cercanos, incluyéndote, sin seleccionar objetivo.' },
  obsidianArrow: { type: 'daño', description: 'Lanza una flecha al enemigo seleccionado al terminar el casteo.' },
  quickShot: { type: 'daño', description: 'Daña al enemigo seleccionado al instante, incluso mientras caminas.' },
  warCry: { type: 'control', description: 'Interrumpe el casteo interrumpible del enemigo seleccionado.' },
  flight: { type: 'movilidad', description: 'Avanza hacia donde caminas o miras y cancela tu casteo.' },
  dodge: { type: 'movilidad', description: 'Esquiva 4 m hacia donde caminas o miras y cancela tu casteo (Espacio).' },
};
