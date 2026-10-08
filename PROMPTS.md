# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --wait --fresh --model gpt-6-astra --effort high` seguido del texto del bloque. **Siempre `--wait`:** en segundo plano la sesión de Codex se aborta a los ~30 s (ver NOTAS, Configuración de Codex).
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

**Dependencias de la Fase 3 (ya instaladas):** en `apps/client`, `phaser` 3.90, `@colyseus/sdk` 0.18 y `@mictlan/core`; de desarrollo, `vite` 8 y `vitest` 4. No hace falta nada más para T3.4–T3.6.

**Contexto común del cliente (T3.1–T3.3, implementadas por Claude):** lee `apps/client/README.md` y las secciones "T3.1 y T3.2" y "T3.3" de NOTAS.md. Toda la lógica vive en módulos puros de `apps/client/src/` con tests en `apps/client/tests/` (patrón: `snapshot.ts` define `RoomSnapshot`, que es `room.state.toJSON()`; `tests/fixtures.ts` crea instantáneas). La escena (`src/scene/ArenaScene.ts`, `hud.ts`, `frame-view.ts`, `arena-renderer.ts`) solo dibuja y conecta: mantenla delgada y pon la lógica nueva en módulos puros con tests. Phaser se importa con `import * as Phaser from 'phaser'` (su ESM no tiene export por defecto). El HUD usa una segunda cámara: todo objeto nuevo del HUD debe agregarse a `hud.objects` para que la cámara del mundo lo ignore, y todo objeto del mundo debe ignorarlo la cámara del HUD. Los eventos de combate llegan por `room.onMessage('events', …)` como `CombatEvent[]` de core.

---

## T3.6 — Ambiente visual procedural

```
Tarea T3.6 — Ambiente visual procedural.

Lee AGENTS.md, SPEC.md (§8 Interfaz y §9 Dirección de arte, en especial "Ambiente del MVP"), la tarea T3.6 de PLAN.md, NOTAS.md (T3.x) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T3.6 en apps/client.

IMPORTANTE: NO ejecutes `npm ci`, `npm install` ni `npm run dev` (Venegas corre los servidores). Sin assets externos ni dependencias nuevas: todo generado con Phaser (Graphics, generateTexture, tweens, partículas, blend modes, postFX). Usa solo APIs que existan en node_modules/phaser/types/phaser.d.ts (Phaser 3.90); si una API es solo WebGL (por ejemplo postFX), deja un respaldo que no truene en Canvas. No hagas commit. No crees archivos de reporte en el repo.

Contexto de T3.4/T3.5 (ya en commit): el log, los números flotantes y el temporizador están en scene/combat-reading-view.ts; las zonas y el anillo de fase 3 en scene/arena-renderer.ts con estilos de danger-reading.ts; el lobby es HTML sobre el canvas (lobby-view.ts, lobby.css) y no se toca. Los estados se validan con isSyncedSnapshot (snapshot.ts).

Objetivo: el ambiente de las referencias de Venegas (WoW, LoL, V Rising; descritas en SPEC §9) sin arte real, sin cambiar la lógica ni los colores por clase del §8 (siguen siendo la base de cada unidad):
1. Escena oscura: fondo obsidiana, viñeta que oscurece los bordes; piso de losas tenues y muro de piedra con grecas en ocre.
2. Unidades: sombra elíptica, borde y una letra o ícono simple por clase; el jefe más grande, con aura turquesa que pulsa mientras castea; los muertos como restos (no solo transparentes).
3. Sobre cada unidad: barra de vida compacta con marco oscuro (estilo LoL) y nombre pequeño. Sin encimarse entre unidades cercanas más de lo inevitable.
4. Peligro: círculos de Viento y zona insegura de fase 3 con brillo aditivo de fuego (rojo/naranja) y borde animado; deben leerse mejor que hoy sobre el piso oscuro.
5. Efectos: partículas breves en golpes, curaciones (verde) y casteos (turquesa) y un destello en la unidad que recibe daño (eventos damage). Ningún efecto tapa un área de daño: si compiten, se atenúa el efecto.
6. Barra de acción: un ícono generado por habilidad y la recarga como barrido circular.
7. Rendimiento: 60 fps con 5 jugadores, 4 xolos y 3 zonas. Deja un contador de fps visible solo con ?dev=1 y reporta cómo medirlo.

La lógica nueva (ícono o letra por clase y habilidad, curvas de pulso y destello, cuándo atenuar un efecto, layout de barras sobre unidades) va en módulos puros con tests; el dibujo, en scene/. Respeta la regla de las dos cámaras: todo objeto del HUD en hud.objects; todo objeto del mundo ignorado por la cámara del HUD.

Criterio (manual de Venegas): el combate se parece en ambiente a las referencias, los avisos de peligro se leen mejor que antes y sigue fluido.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye la descripción de lo que cambió, qué probaste a mano y qué debe revisar Venegas).
```
