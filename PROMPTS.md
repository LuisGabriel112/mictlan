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

---

## T4.4 — Resumen del intento

```
Tarea T4.4 — Resumen del intento.

Lee AGENTS.md, SPEC.md §7 (mensajes) y §8, la tarea T4.4 de PLAN.md, NOTAS.md (T3.4, T3.5) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T4.4 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

Motivo (Checkpoint B): el grupo perdió y dijo "le bajo una miseria, no veo los ataques". Sin números no sabemos si falla la vida del jefe, los casteos cancelados o las habilidades rechazadas.

1. Módulo puro `attempt-summary.ts`: acumula los CombatEvent del intento (los que ya llegan por room.onMessage('events')) y produce, por jugador: daño total y DPS (daño / segundos del intento), curación efectiva total y HPS, casteos cancelados (castCancelled, por motivo: moving, interrupted, etc.), habilidades rechazadas (abilityRejected, por motivo), golpes recibidos por habilidad del jefe (damage con abilityId y total), y causa de muerte (evento death: habilidad y autor). Los segundos salen de elapsedTicks del snapshot (COMBAT_RULES.ticksPerSecond). Se reinicia al empezar cada intento (status pasa a 'combat') y se conserva hasta que el servidor vuelve al lobby.
2. Pantalla de resultado (HTML, la de T3.5: result-screen en index.html y lobby-view.ts): bajo "¡Victoria!"/"Derrota" y la duración, una tabla por jugador con esas columnas, nombres de habilidad en español (abilityName de combat-names.ts) y nombre del jugador como en el log (entityName). El propio jugador resaltado. Debe caber en pantallas angostas (tabla con scroll horizontal si hace falta).
3. Comparación con bots: bajo la tabla, una línea fija "Referencia de bots perfectos (3 jugadores): Jaguar 25 DPS · Águila 58 DPS · Tícitl 27 HPS". Sale de constantes del cliente con un comentario que cite el simulador (npm run sim).
4. El acumulador debe tolerar eventos antes del primer estado y no truena con estado incompleto (usa isSyncedSnapshot).

Lógica pura con tests: acumulación de cada tipo de evento, DPS/HPS, reinicio por intento, causa de muerte, y el formateo de la fila.

Criterio (manual de Venegas): tras una derrota, el grupo ve cuánto daño hizo cada uno, cuántos casteos y habilidades se perdieron y por qué murió cada quien.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```

---

## T4.6 — Animación de daño al jefe

```
Tarea T4.6 — Animación de daño al jefe.

Lee AGENTS.md, SPEC.md §9, la tarea T4.6 de PLAN.md y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T4.6 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

1. Módulo puro `hit-flash.ts`: registra golpes (evento damage con targetId, critical) con el tiempo inyectado y devuelve por entidad una intensidad 0..1 y un factor de escala (pulso breve ~200 ms, decae lineal). El crítico dura más, escala más y usa color amarillo (palette). Golpes seguidos reinician sin acumular más allá de 1.
2. Conectar los eventos que ya llegan por room.onMessage('events') y dibujar en scene/arena-renderer.ts: relleno blanco/amarillo con alpha = intensidad sobre el círculo del jefe y radio * escala. Solo el jefe (no jugadores ni xolos).
3. No debe tapar la barra de vida ni las marcas de selección.

Tests de lógica pura: decaimiento, reinicio, crítico vs normal, entidad sin golpes, reloj inyectado.
Criterio (manual de Venegas): cada golpe al jefe se nota; no es un destello constante con 3 atacantes.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```

---

## T4.7 — Tutorial in-game

```
Tarea T4.7 — Tutorial in-game.

Lee AGENTS.md, SPEC.md §5.4 y §8, las tareas T4.3 y T4.7 de PLAN.md, role-guide.ts, help-*.ts y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T4.7 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo.

1. Máquina de estados pura `tutorial-steps.ts`: pasos 1) seleccionar al jefe, 2) moverse (clic derecho), 3) usar la primera habilidad del rol, 4) salir de una zona roja o casteo de peligro. Cada paso se completa solo al detectarlo en snapshot/eventos propios. Entrada: snapshot + eventos + selfId; salida: paso actual, texto y si terminó. Tolera snapshot incompleto (isSyncedSnapshot).
2. Persistencia inyectada (interfaz con get/set; en producción localStorage con try/catch): se muestra solo si no se completó ni saltó antes. Reabrible con T (H ya abre la ayuda de T4.3).
3. Vista HTML (panel pequeño arriba-centro, no tapa la barra de acción ni los marcos): texto del paso, "Paso 2/4", botón "Saltar". Textos por rol desde role-guide.ts; en español.
4. Se reinicia el progreso del paso 4 si el jugador muere; el tutorial no bloquea la entrada ni pausa el combate.

Tests de lógica pura: avance por paso, saltar, persistencia inyectada, snapshot incompleto, muerte.
Criterio (manual de Venegas): un jugador nuevo completa los 4 pasos sin preguntar; puede saltarlo y repetirlo.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```
