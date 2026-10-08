# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --wait --fresh --model gpt-6-astra --effort high` seguido del texto del bloque. **Siempre `--wait`:** en segundo plano la sesión de Codex se aborta a los ~30 s (ver NOTAS, Configuración de Codex).
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

**Dependencias de la Fase 3 (ya instaladas):** en `apps/client`, `phaser` 3.90, `@colyseus/sdk` 0.18 y `@mictlan/core`; de desarrollo, `vite` 8 y `vitest` 4. No hace falta nada más para T3.4–T3.6.

**Contexto común del cliente (T3.1–T3.3, implementadas por Claude):** lee `apps/client/README.md` y las secciones "T3.1 y T3.2" y "T3.3" de NOTAS.md. Toda la lógica vive en módulos puros de `apps/client/src/` con tests en `apps/client/tests/` (patrón: `snapshot.ts` define `RoomSnapshot`, que es `room.state.toJSON()`; `tests/fixtures.ts` crea instantáneas). La escena (`src/scene/ArenaScene.ts`, `hud.ts`, `frame-view.ts`, `arena-renderer.ts`) solo dibuja y conecta: mantenla delgada y pon la lógica nueva en módulos puros con tests. Phaser se importa con `import * as Phaser from 'phaser'` (su ESM no tiene export por defecto). El HUD usa una segunda cámara: todo objeto nuevo del HUD debe agregarse a `hud.objects` para que la cámara del mundo lo ignore, y todo objeto del mundo debe ignorarlo la cámara del HUD. Los eventos de combate llegan por `room.onMessage('events', …)` como `CombatEvent[]` de core.

---

## T3.5 — Lobby jugable

```
Tarea T3.5 — Lobby jugable.

Lee AGENTS.md, SPEC.md (§5 composición, §7 mensajes, §8 Lobby), la tarea T3.5 de PLAN.md, NOTAS.md (T2.1, T2.4, T3.x) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T3.5 en apps/client. El servidor ya tiene todo el lobby (T2.1/T2.4): código de 4 letras, `ready { classId }`, `rejected { reason }` y regreso al lobby 5 s después del fin con ready = false.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`. Usa npm.cmd. No hagas commit.

1. Pantalla de inicio (sin `?dev=1`): "Crear sala" (client.create('raid')) o escribir un código y "Unirse" (joinById). Si el código no existe, mensaje claro. `?code=ABCD` en la URL rellena el código. Puede ser DOM/HTML sobre el canvas o Phaser: elige lo más simple y documenta por qué.
2. Lobby: el código en grande (para compartirlo), la lista de jugadores con su clase y si están listos, y los roles que faltan según SPEC §5 (falta Jaguar, falta Tícitl, falta al menos un Águila; máximo 5). Botones para elegir clase y "Listo". Un `rejected` muestra el motivo en español (composition → "Ese rol ya está ocupado", invalid_class → "Clase inválida").
3. Combate: al pasar status a 'combat' se ve la escena actual (T3.1–T3.4).
4. Resultado: con status 'victory' o 'defeat', pantalla de "¡Victoria!" o "Derrota" con la duración del encuentro; cuando el servidor vuelve a 'lobby' (5 s), el cliente regresa al lobby con la clase conservada y "Listo" desmarcado.
5. `?dev=1` sigue funcionando como hoy (se salta el inicio y el lobby).
6. Lógica pura con tests: roles faltantes a partir de los jugadores del lobby, texto de los rechazos y qué pantalla toca según status y si hay sala.

Criterios (manual de Venegas, más tests de la lógica pura):
1. 3 pestañas completan el flujo lobby → combate → resultado → lobby (con `npm run dev` y MICTLAN_DEV_MIN_PLAYERS en 3).
2. Un segundo Jaguar ve "Ese rol ya está ocupado".

Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué probaste a mano y qué no).
```

---

## T3.6 — Pulido visual procedural

```
Tarea T3.6 — Pulido visual procedural.

Lee AGENTS.md, SPEC.md (§8 y §9 Dirección de arte), la tarea T3.6 de PLAN.md y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T3.6 en apps/client.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`. Sin assets externos ni dependencias nuevas: todo generado con Phaser (Graphics, texturas con generateTexture, tweens, partículas si existen en 3.90). Usa solo APIs de los tipos instalados (node_modules/phaser/types/phaser.d.ts). No hagas commit.

Objetivo: que el combate se lea mejor que con círculos planos, con la paleta del §9 (ocres, negro obsidiana, turquesa), sin cambiar la lógica ni los colores por clase del §8 (siguen siendo la base de cada unidad).
1. Arena: piso con textura (ruido o losas) y muro con patrón de grecas.
2. Unidades: sombra, borde y una letra o ícono simple por clase; el jefe más grande, con un aura que pulsa mientras castea; los muertos como restos (no solo transparentes).
3. Nombres pequeños sobre las unidades y barras de vida con mejor estilo.
4. Círculos de Viento con borde animado y destello breve al recibir daño (eventos damage).
5. Barra de acción con un ícono generado por habilidad y la recarga como barrido circular.
6. Rendimiento: 60 fps con 5 jugadores, 4 xolos y 3 zonas (mídelo con el fps de Phaser y repórtalo).

La lógica nueva (qué ícono o letra corresponde a cada clase o habilidad, curvas de animación) va en módulos puros con tests; el dibujo, en scene/.

Criterio (manual de Venegas): el combate se lee mejor que antes y sigue fluido.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye la descripción de lo que cambió y el fps medido).
```
