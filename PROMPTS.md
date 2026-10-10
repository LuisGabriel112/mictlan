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

---

## T5.1 — Escena 3D y entrada (Three.js)

```
Tarea T5.1 — Escena 3D y entrada.

Lee AGENTS.md, SPEC.md §3, §5, §8 y §9, la tarea T5.1 de PLAN.md, NOTAS.md (T3.1–T3.7, T4.6) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T5.1 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo. `three` 0.186 y `@types/three` ya están instalados (Claude); no agregues dependencias.

Decisión de diseño (de Claude, aprobada): el MUNDO pasa a Three.js; Phaser se queda SOLO como capa de HUD transparente encima (barra de acción, marcos, barras de casteo, log, textos flotantes) hasta T5.2, que lo pasa a HTML. Así el HUD actual sigue funcionando y no se rehace dos veces.

1. Canvas de Three (WebGLRenderer, fondo #14101c) en #game debajo del canvas de Phaser, que pasa a fondo transparente (`transparent: true`) y ya no dibuja el mundo. El de Phaser conserva el teclado y el puntero; el de Three no recibe eventos.
2. Escena: piso circular de radio COMBAT_RULES.arena.wallRadiusMeters, muro como anillo (color 0xd9c08c), unidades como formas simples: jugadores cilindros del color de entityColor(), jefe un cilindro grande morado, xolos conos grises, radio = entityRadius(). Muertos al 30 % de opacidad. Aro blanco bajo el propio jugador, aro amarillo bajo el objetivo, marcador de destino (T3.7), zonas de Viento como discos rojos con alpha y borde según windWarningStyle (danger-reading.ts), anillo del radio seguro en fase 3 según unsafeRing, y el destello del jefe de T4.6 (hitFlashFor) como emisivo + escala.
3. Mundo → Three: x este, y norte del core se mapea a (x, 0, -y) de Three (1 unidad = 1 m). Módulo puro `world-3d.ts` con esa conversión y su inversa.
4. Cámara isométrica fija (ortográfica, mirando al centro desde el sureste-arriba, ~35° de elevación, ~45° de giro), encuadrada para que quepa el diámetro de la arena + margen (VIEW_MARGIN_METERS) en cualquier tamaño de ventana, y se reencuadra al redimensionar. Módulo puro `camera-rig.ts` con la matemática (parámetros → posición/frustum), sin importar three.
5. Entrada por raycast: módulo puro `ground-pick.ts` que, dada la cámara ortográfica (parámetros del rig) y un punto de pantalla, devuelve el punto del suelo (y=0) en coordenadas de mundo; y su inversa `worldToPixel` para los textos flotantes y marcos del HUD (que hoy usan worldToScreen/PIXELS_PER_METER de Phaser: adapta hud.ts/combat-reading-view.ts para recibir esa proyección inyectada). Clic izquierdo selecciona (entityAtPoint con el punto del suelo, groupFrameAt sigue igual), clic derecho camina, Tab, F1–F5, Q W E R, S: el mismo comportamiento que hoy; ArenaScene sigue manejando input pero con ground-pick en lugar de la cámara de Phaser.
6. Interpolación: reutiliza PositionHistory tal cual. Bucle de render con requestAnimationFrame o el update de Phaser (elige uno y justifícalo); libera recursos (geometrías, materiales) al volver al lobby.
7. No bajes de 60 fps con 5 jugadores, 4 xolos y 3 zonas (mallas reutilizadas, sin crear objetos por frame).

Lógica pura con tests (Vitest, sin WebGL real; mockea three o prueba solo los módulos puros): world-3d, camera-rig, ground-pick (ida y vuelta pantalla↔mundo con varios tamaños de ventana), y la selección de objetivo con el punto del suelo. Los módulos que importen three van detrás de una interfaz inyectable.

Criterio (manual de Venegas): se juega un intento completo igual que con Phaser (seleccionar, caminar, lanzar, esquivar vientos, ver marcos y barras), la cámara se ve isométrica y las unidades se distinguen por color.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```

---

## T5.2 — HUD en HTML

```
Tarea T5.2 — HUD en HTML.

Lee AGENTS.md, SPEC.md §8, §9 y §11, la tarea T5.2 de PLAN.md, NOTAS.md (T3.2–T3.4, T5.1, T6.x) y el "Contexto común del cliente" de PROMPTS.md. Implementa SOLO T5.2 en apps/client. No toques core ni server.

IMPORTANTE: NO ejecutes `npm ci`, `npm install`, `npm run dev` ni `npm run start`. Usa npm.cmd. No hagas commit. No crees archivos de reporte en el repo. No agregues dependencias.

Estado actual: el mundo es Three.js (src/world-3d/); Phaser queda SOLO como capa transparente de HUD e input (src/scene/ArenaScene.ts, hud.ts, frame-view.ts, combat-reading-view.ts, unit-bars.ts). T5.2 elimina Phaser por completo.

1. Pasar a HTML/CSS (como lobby-view.ts y help-view.ts, DOM inyectado y testeable con fixtures tipo help-dom-fixtures.ts) todo lo que hoy dibuja Phaser: marcos propio/objetivo/grupo (frames.ts), barras de casteo propia/objetivo/jefe, barra de acción de 4 espacios + Esquiva en Espacio (action-bar.ts, con recarga y estado), log de combate (combat-log.ts), encabezado con tiempo y fase, aviso de rechazo (rejectionFlash), números flotantes proyectados con ArenaWorld.project (floating-texts.ts) y barras de vida sobre las unidades (hoy unit-bars.ts; estilo LoL: compactas, marco oscuro). Reusa los módulos puros existentes y su layout (reading-layout.ts); los tooltips de T4.3 (help-view) deben seguir alineados con los botones.
2. La entrada (teclado WASD/1-4/Espacio/X/Tab/F1-F5, clic izquierdo con unitAtPixel y groupFrameAt, clic derecho con ArenaWorld.pick) pasa a un controlador sin Phaser que escucha el canvas/contenedor #game; el bucle de render con requestAnimationFrame (o el que justifiques), sin crear objetos por cuadro.
3. Quitar la dependencia de Phaser del cliente (imports, main.ts, phaser-fixtures en tests). No desinstales el paquete: solo deja de usarse; Claude lo quita de package.json después.
4. El HTML del HUD actualiza el DOM solo cuando cambia el valor (evitar reflujo a 60 fps).

Tests: cada vista nueva con DOM falso; el controlador de entrada con eventos falsos; conservar la cobertura actual de lobby-arena, hit-flash-scene, reading-integration y reading-view adaptándolas.
Criterio (manual de Venegas): misma información que el HUD de Phaser; los números no tapan el HUD; 60 fps con 5 jugadores.
Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md (incluye qué debe revisar Venegas en el navegador).
```
