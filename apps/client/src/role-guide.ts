import { CLASSES, type ClassId } from '@mictlan/core';

export const COMMON_CONTROLS = 'clic derecho camina, S se detiene, Tab cambia de enemigo, clic selecciona, F1–F5 seleccionan aliados, Q W E R lanzan habilidades.';

// SPEC §5.4 is the reviewed teaching copy; preserve it verbatim.
const ROLE_GUIDES = {
  jaguar: [
    { title: 'Tu trabajo', text: 'que el jefe te pegue a ti y no a los demás. Ponte frente a él (a 4 m o menos) y no te alejes.' },
    { title: 'Rotación', text: 'Zarpazo (Q) cada vez que esté listo. Rugido (R) al empezar y cuando aparezcan xolos. Provocar (W) si el jefe o un xolo se va con otro jugador.' },
    { title: 'Lo más importante', text: 'cuando el jefe castee Golpe del Descarnado sobre ti (no se puede interrumpir), usa Escudo de obsidiana (E) antes de que termine: sin Escudo recibes 280, con Escudo 140.' },
    { title: 'Evita', text: 'los círculos rojos de Viento de obsidiana; en la fase 3, salir del círculo seguro.' },
    { title: 'Con tu grupo', text: 'mantén al jefe cerca del centro; en la fase 2 atrae a los xolos, que van por el Tícitl.' },
  ],
  healer: [
    { title: 'Tu trabajo', text: 'mantener vivos a todos, sobre todo al Jaguar. Selecciona aliados con F1–F5 o con clic en su marco.' },
    { title: 'Rotación', text: 'Copal (E) siempre activo en el Jaguar. Remedio (Q) para el daño normal. Gran remedio (W) cuando alguien esté bajo y tengas 3 s. Ofrenda (R) justo después de un Lamento de los muertos, que golpea a todos.' },
    { title: 'Maná', text: 'regenera 18 por segundo; no gastes Gran remedio en alguien casi lleno.' },
    { title: 'Evita', text: 'los círculos rojos de Viento; sal antes de empezar un casteo largo. En la fase 2 los xolos van por ti: acércate al Jaguar.' },
    { title: 'Con tu grupo', text: 'avisa cuando te quedes sin maná.' },
  ],
  eagle: [
    { title: 'Tu trabajo', text: 'hacer daño desde lejos y cortar el Lamento de los muertos.' },
    { title: 'Rotación', text: 'Disparo veloz (W) cada vez que esté listo; Flecha de obsidiana (Q) el resto del tiempo (2 s de casteo).' },
    { title: 'Lo más importante', text: 'cuando el jefe castee Lamento de los muertos (borde turquesa: se puede interrumpir), usa Grito de guerra (E) con el jefe seleccionado: lo cancela y nadie recibe daño. Si hay varios Águilas, túrnense.' },
    { title: 'Evita', text: 'los círculos rojos de Viento: sal caminando o con Vuelo (R, 8 m). En la fase 3, quédate dentro del círculo seguro.' },
    { title: 'Con tu grupo', text: 'en la fase 2, mata primero a los xolos (Tab para seleccionarlos).' },
  ],
} as const;

export function roleGuide(classId: ClassId) {
  return { name: CLASSES[classId].name, sections: ROLE_GUIDES[classId], controls: COMMON_CONTROLS };
}
