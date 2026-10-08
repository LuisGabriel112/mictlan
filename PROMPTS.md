# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --wait --fresh --model gpt-6-astra --effort high` seguido del texto del bloque. **Siempre `--wait`:** en segundo plano la sesión de Codex se aborta a los ~30 s (ver NOTAS, Configuración de Codex).
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

**Dependencias de la Fase 3 (ya instaladas):** en `apps/client`, `phaser` 3.90, `@colyseus/sdk` 0.18 y `@mictlan/core`; de desarrollo, `vite` 8 y `vitest` 4. No hace falta nada más para T3.4–T3.6.

**Contexto común del cliente (T3.1–T3.3, implementadas por Claude):** lee `apps/client/README.md` y las secciones "T3.1 y T3.2" y "T3.3" de NOTAS.md. Toda la lógica vive en módulos puros de `apps/client/src/` con tests en `apps/client/tests/` (patrón: `snapshot.ts` define `RoomSnapshot`, que es `room.state.toJSON()`; `tests/fixtures.ts` crea instantáneas). La escena (`src/scene/ArenaScene.ts`, `hud.ts`, `frame-view.ts`, `arena-renderer.ts`) solo dibuja y conecta: mantenla delgada y pon la lógica nueva en módulos puros con tests. Phaser se importa con `import * as Phaser from 'phaser'` (su ESM no tiene export por defecto). El HUD usa una segunda cámara: todo objeto nuevo del HUD debe agregarse a `hud.objects` para que la cámara del mundo lo ignore, y todo objeto del mundo debe ignorarlo la cámara del HUD. Los eventos de combate llegan por `room.onMessage('events', …)` como `CombatEvent[]` de core.

---

## T4.3 — Habilidades y roles legibles

```
Tarea T4.3 — Habilidades y roles legibles.

Lee AGENTS.md, SPEC.md §5 (clases y la nueva §5.4 "Ayuda en el juego"), la tarea T4.3 de PLAN.md, NOTAS.md (T3.5, T4.1) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T4.3 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

Motivo (Checkpoint B): en el primer playtest nadie pasó de la fase 1 porque "solo presionas teclas y no sabes qué hace cada cosa".

Todo en HTML/CSS sobre el canvas, como el lobby (lobby-view.ts, lobby.css), porque en la Fase 5 se reemplaza Phaser y esto debe sobrevivir.
1. Panel de clase en el lobby: al elegir clase (y antes de marcar Listo), mostrar rol, vida/recurso y sus 4 habilidades con tecla, nombre, etiqueta de tipo (§5.4), descripción de una línea, costo, casteo o "instantánea", recarga y alcance. Los números salen de CLASSES en core (no los copies a mano); la descripción en español va en un módulo del cliente.
2. Botón "Cómo jugar" en el lobby que abre la guía del rol elegido con el texto de §5.4 (tu trabajo, rotación, lo más importante, evita, con tu grupo, más los controles comunes). Usa el texto del SPEC tal cual; si algo no cuadra con los datos de core, detente y repórtalo.
3. En combate: etiqueta de tipo en cada botón de la barra de acción y tooltip al pasar el mouse con lo mismo que el panel. Como la barra de acción hoy la dibuja Phaser (scene/hud.ts), el tooltip es un elemento HTML posicionado sobre el botón con el layout que ya existe (reading-layout.ts / hud.ts); la detección del hover puede venir de Phaser o del DOM, elige lo más simple y documenta por qué.
4. La guía también se puede abrir en combate con una tecla que no choque con las existentes (propón cuál; H si está libre) y se cierra con Esc o la misma tecla.

Lógica pura con tests: texto de cada habilidad (tipo, costo, casteo, recarga, alcance) a partir de los datos de core, contenido de la guía por clase y qué tooltip corresponde a qué botón.

Criterio (manual de Venegas): un jugador nuevo, tras leer la guía de su rol, sabe qué tecla usar y cuándo sin preguntar.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```
