# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --wait --fresh --model gpt-6-astra --effort high` seguido del texto del bloque. **Siempre `--wait`:** en segundo plano la sesión de Codex se aborta a los ~30 s (ver NOTAS, Configuración de Codex).
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

**Dependencias de la Fase 3 (ya instaladas):** en `apps/client`, `phaser` 3.90, `@colyseus/sdk` 0.18 y `@mictlan/core`; de desarrollo, `vite` 8 y `vitest` 4. No hace falta nada más para T3.4–T3.6.

**Contexto común del cliente (T3.1–T3.3, implementadas por Claude):** lee `apps/client/README.md` y las secciones "T3.1 y T3.2" y "T3.3" de NOTAS.md. Toda la lógica vive en módulos puros de `apps/client/src/` con tests en `apps/client/tests/` (patrón: `snapshot.ts` define `RoomSnapshot`, que es `room.state.toJSON()`; `tests/fixtures.ts` crea instantáneas). La escena (`src/scene/ArenaScene.ts`, `hud.ts`, `frame-view.ts`, `arena-renderer.ts`) solo dibuja y conecta: mantenla delgada y pon la lógica nueva en módulos puros con tests. Phaser se importa con `import * as Phaser from 'phaser'` (su ESM no tiene export por defecto). El HUD usa una segunda cámara: todo objeto nuevo del HUD debe agregarse a `hud.objects` para que la cámara del mundo lo ignore, y todo objeto del mundo debe ignorarlo la cámara del HUD. Los eventos de combate llegan por `room.onMessage('events', …)` como `CombatEvent[]` de core.

---

## T4.2 — Balance: vida del jefe

```
Tarea T4.2 — Balance: vida del jefe.

Lee AGENTS.md, SPEC.md §6 (Jefe: "Vida según número de jugadores", ya actualizada a v0.8) y la tarea T4.2 de PLAN.md. Implementa SOLO T4.2.

IMPORTANTE: NO ejecutes `npm ci`, `npm install` ni `npm run dev`/`npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

1. packages/core/src/data/boss.ts: vida 3 → 15000, 4 → 25000, 5 → 35000.
2. Actualiza los tests que dependían de 24000/40000/56000 (core, server y client: grep los números). Donde un test solo necesitaba "la vida del jefe", léela de los datos en vez de repetir el literal.
3. Corre `npm.cmd run sim -- --players=3 --runs=50`, y también con 4 y 5 jugadores. Reporta victorias, duración media y DPS/HPS por clase.

Criterio: con 3 jugadores, 100 % de victorias y duración media de 3:00 a 4:00. Si no cae en ese rango, NO ajustes otros números: detente y reporta los resultados.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```
