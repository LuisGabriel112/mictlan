# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --wait --fresh --model gpt-6-astra --effort high` seguido del texto del bloque. **Siempre `--wait`:** en segundo plano la sesión de Codex se aborta a los ~30 s (ver NOTAS, Configuración de Codex).
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

**Dependencias de la Fase 3 (ya instaladas):** en `apps/client`, `phaser` 3.90, `@colyseus/sdk` 0.18 y `@mictlan/core`; de desarrollo, `vite` 8 y `vitest` 4. No hace falta nada más para T3.4–T3.6.

**Contexto común del cliente (T3.1–T3.3, implementadas por Claude):** lee `apps/client/README.md` y las secciones "T3.1 y T3.2" y "T3.3" de NOTAS.md. Toda la lógica vive en módulos puros de `apps/client/src/` con tests en `apps/client/tests/` (patrón: `snapshot.ts` define `RoomSnapshot`, que es `room.state.toJSON()`; `tests/fixtures.ts` crea instantáneas). La escena (`src/scene/ArenaScene.ts`, `hud.ts`, `frame-view.ts`, `arena-renderer.ts`) solo dibuja y conecta: mantenla delgada y pon la lógica nueva en módulos puros con tests. Phaser se importa con `import * as Phaser from 'phaser'` (su ESM no tiene export por defecto). El HUD usa una segunda cámara: todo objeto nuevo del HUD debe agregarse a `hud.objects` para que la cámara del mundo lo ignore, y todo objeto del mundo debe ignorarlo la cámara del HUD. Los eventos de combate llegan por `room.onMessage('events', …)` como `CombatEvent[]` de core.

---

## T4.1 — Jugar con amigos

```
Tarea T4.1 — Jugar con amigos.

Lee AGENTS.md, SPEC.md, la tarea T4.1 de PLAN.md (incluido "Además"), NOTAS.md (T2.x, T3.5) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T4.1 (apps/server, apps/client, package.json raíz, README). No toques core.

IMPORTANTE: NO ejecutes `npm ci`, `npm install` ni `npm run dev` (Venegas corre los servidores). Sin dependencias nuevas: `express` ya está instalado (lo trae @colyseus/ws-transport); si no lo puedes importar sin agregarlo a package.json, usa node:http y node:fs y documenta por qué. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

1. `npm run start` en la raíz: compila el cliente (vite build) y levanta UN solo proceso que sirve `apps/client/dist` y el servidor de Colyseus en el mismo puerto (PORT, por defecto 2567). Rutas desconocidas que no sean archivos → index.html. Sin MICTLAN_DEV_MIN_PLAYERS en producción (usa el mínimo real del SPEC).
2. URL del servidor en el cliente: hoy es `ws://<hostname>:2567` (launch-params.ts). Cuando la página la sirve el propio servidor (build de producción), debe ser el mismo origen: `wss://<host>` si la página es https, `ws://<host>` si es http, sin forzar puerto, para que funcione detrás de un túnel https. En dev con Vite se conserva el comportamiento actual. `?server=` sigue teniendo prioridad. Lógica pura con tests.
3. `"dev": "vite --host"` en apps/client/package.json (red local sin pasar flags a mano).
4. README (raíz o apps/server, elige y justifica): cómo jugar en red local (URL Network de Vite, permiso del firewall de Windows con perfil Privado) y cómo exponer `npm run start` con Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:2567`) para amigos en otras redes.
5. Tests del servidor: que sirva index.html y un archivo estático, y que el WebSocket de Colyseus siga funcionando en el mismo puerto (puedes usar un dist falso en un directorio temporal).

Criterios:
1. 3 personas en redes distintas completan un intento (manual de Venegas, por túnel).
2. `npm run start` funciona desde un clon limpio después de `npm ci`.

Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué probaste a mano y los pasos exactos para que Venegas pruebe el túnel).
```
