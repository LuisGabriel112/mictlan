# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --fresh --model gpt-6-astra --effort high` seguido del texto del bloque.
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

---

## T2.1 — Sala de Colyseus y lobby

```
Tarea T2.1 — Sala de Colyseus y lobby.

Lee AGENTS.md, SPEC.md (§5 composición, §7 completo, §8 lobby), la tarea T2.1 de PLAN.md y NOTAS.md (decisiones de T1.2 y Configuración). Implementa SOLO T2.1.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: tu sandbox no tiene red. Las dependencias ya están instaladas (ver apps/server/package.json). Si te falta alguna, detente y pídela. Usa npm.cmd (Windows PowerShell). No hagas commit.

REGLA CRÍTICA DE AGENTS.md: Colyseus 0.18 y @colyseus/schema 5 cambiaron mucho respecto a versiones anteriores. Usa SOLO APIs que existan en los tipos instalados (lee node_modules/@colyseus/core, @colyseus/schema, @colyseus/ws-transport y @colyseus/sdk: sus .d.ts y README). No escribas código de memoria de 0.14/0.15/0.16. En el reporte, lista las APIs de Colyseus que usaste y el archivo .d.ts donde comprobaste cada una.

Parte A — core (packages/core):
1. `EncounterConfig.devMode?: boolean`. Sin devMode, createEncounter exige 3–5 jugadores (como hoy). Con devMode: true acepta 1–5; con 1 o 2 jugadores, la vida del jefe y la de los xolos usan los valores de 3 jugadores (SPEC §7). Corrige también mechanics/xolos.ts, que hoy indexa por `players.length` sin acotar. Nada de números sueltos: la regla "valores de 3" sale de PARTY_RULES.minPlayers.
2. Añade a packages/core/package.json `"exports": { ".": "./src/index.ts" }` para que el servidor importe `@mictlan/core` (lo consumen tsx y vitest; no hay build de core). Comprueba que typecheck lo resuelve.

Parte B — servidor (apps/server):
3. Estructura: src/index.ts (arranca el servidor HTTP+WS en el puerto PORT, por defecto 2567), src/rooms/RaidRoom.ts, src/schema/ (estado del lobby), src/lobby.ts (reglas puras de composición, testeables sin red). tsconfig.json propio que extienda tsconfig.base.json con types node (y lo que exija @colyseus/schema 5 según sus tipos). Dependencia "@mictlan/core": "*" en apps/server/package.json (workspace; no requiere red).
4. Scripts: en apps/server, "typecheck", "test" (vitest run) y "dev" (tsx src/index.ts). En el package.json raíz, "test" y "typecheck" deben correr core y server (p. ej. `--workspaces --if-present`), de modo que `npm run check` cubra ambos. `lint` ya cubre todo el repo; asegúrate de que el servidor pase sin desactivar reglas.
5. Sala `raid`:
   - Código de sala de 4 letras mayúsculas A–Z, único entre las salas activas, que sirve para unirse (el cliente se une por ese código). Investiga en los tipos instalados cómo fijar el roomId o cómo resolver un código a una sala; documenta la elección.
   - maxClients 5. El id de jugador en core será el sessionId.
   - Estado del lobby sincronizado (schema): status ('lobby' | 'combat' | 'victory' | 'defeat'), código y jugadores { id, classId (vacío si no eligió), ready }.
   - Mensaje `ready { classId }`: valida que classId sea 'jaguar' | 'healer' | 'eagle' y la composición de SPEC §5 contando a los jugadores ya listos: como máximo 1 Jaguar, 1 Tícitl y 3 Águilas. Si se rechaza, envía solo a ese cliente un mensaje `rejected { reason }` con reason 'invalid_class' | 'composition' y no lo marca listo. Payload mal formado → 'invalid_class', sin excepciones.
   - Inicio: cuando todos los conectados están listos, hay entre minPlayers y 5, y la composición está completa (exactamente 1 Jaguar, 1 Tícitl y al menos 1 Águila): status pasa a 'combat' y se crea el encuentro con createEncounter (semilla aleatoria del servidor; aquí sí se permite Math.random porque no es core). En T2.1 no hay bucle de combate todavía: solo se crea y se guarda el estado.
   - MICTLAN_DEV_MIN_PLAYERS (entero 1–3, por defecto 3; valor inválido → 3). Si es < 3: minPlayers baja a ese valor, la composición se relaja (sigue prohibiendo duplicar Jaguar o Tícitl, pero no exige tenerlos) y createEncounter recibe devMode: true.
6. Tests de integración con vitest: levantan el servidor en proceso en un puerto libre y se conectan con el cliente de @colyseus/sdk; cierran todo al terminar. Lógica pura de composición con tests unitarios aparte.

Criterios (un test por punto):
1. Integración: 3 clientes se unen por el código, se marcan listos (Jaguar, Tícitl, Águila) y el estado sincronizado pasa a 'combat'.
2. Un segundo Jaguar recibe `rejected { reason: 'composition' }` y no queda listo.
3. Con MICTLAN_DEV_MIN_PLAYERS=1 un solo cliente puede iniciar.
4. Core: sin devMode, createEncounter con 2 jugadores lanza error; con devMode: true, 1 jugador funciona y el jefe tiene 24 000 de vida; los xolos invocados con 2 jugadores en devMode tienen 300.
5. El código de sala tiene 4 letras A–Z y dos salas simultáneas tienen códigos distintos.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T2.2 — Bucle de combate y entradas

```
Tarea T2.2 — Bucle de combate y entradas.

Lee AGENTS.md, SPEC.md (§3 y §7, sobre todo "Mensajes cliente → servidor"), la tarea T2.2 de PLAN.md, NOTAS.md (orden del tick de T1.3 y T1.7; recordatorio de T2.2) y el código de T2.1 en apps/server. Implementa SOLO T2.2.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`. Usa npm.cmd. No hagas commit. Usa solo APIs de Colyseus que existan en los tipos instalados y lístalas en el reporte con su .d.ts.

1. Bucle: al pasar a 'combat', usa el mecanismo de simulación de la sala que exista en los tipos instalados (p. ej. un intervalo de simulación) con un acumulador de tiempo: por cada 50 ms acumulados llama exactamente una vez a step(state, inputs, 50). Limita los pasos por llamada (p. ej. 5) para no entrar en espiral si el proceso se atrasa, y descarta el sobrante. El bucle se detiene cuando core devuelve status 'victory' o 'defeat' (el regreso al lobby es T2.4).
2. Entradas: los mensajes `move`, `target` y `cast` se encolan por jugador y se consumen en el siguiente step (todas las de ese intervalo). Solo se aceptan en 'combat' y de jugadores del encuentro.
3. Validación (nada debe lanzar excepción ni tumbar la sala):
   - move { dx, dy }: números finitos (descarta NaN e Infinity: hoy core deja la posición en NaN). Si la longitud es 0 → (0,0); si no, se normaliza a longitud 1.
   - target { entityId }: string o null; si no, se ignora. (Core ya ignora ids inexistentes.)
   - cast { abilityId }: string; si no es un PlayerAbilityId válido, se ignora.
   - Payload que no es objeto → se ignora.
   - Sin rate limit por ahora, pero como máximo se guardan N entradas por jugador por tick (elige N razonable y documéntalo) para que un cliente no infle la memoria.
4. Prueba determinista: permite inyectar en la sala (solo en tests, p. ej. por opciones de creación que el servidor real no use) la semilla y critChance, para que el test de la Flecha pueda usar critChance 0.

Criterios (un test por punto):
1. Integración: en una sala dev de 1 Águila, el cliente selecciona al jefe, se coloca a ≤ 30 m y castea Flecha; tras 2 s la vida del jefe baja exactamente 140 con critChance 0.
2. Mensajes inválidos (payload mal formado, entidad inexistente, abilityId desconocido, NaN/Infinity, vector sin normalizar) no tumban la sala: se ignoran o se normalizan, y la partida sigue avanzando.
3. Un move de longitud 3 mueve exactamente lo mismo que uno de longitud 1 en la misma dirección.
4. El bucle avanza un tick por cada 50 ms: tras ~1 s de simulación el tick del encuentro está en 20 ± 2.

Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T2.3 — Estado sincronizado y eventos

```
Tarea T2.3 — Estado sincronizado y eventos.

Lee AGENTS.md, SPEC.md (§7 "Estado sincronizado" y §8), la tarea T2.3 de PLAN.md, NOTAS.md y el código de T2.1–T2.2. Implementa SOLO T2.3.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`. Usa npm.cmd. No hagas commit. Usa solo APIs de @colyseus/schema 5 y @colyseus/core 0.18 que existan en los tipos instalados y lístalas en el reporte con su .d.ts.

1. Esquema: extiende el estado sincronizado con todo SPEC §7: entidades (id, type, classId, x, y, health, maxHealth, mana/maxMana, targetId, casteo actual { abilityId, targetId, durationTicks, remainingTicks, interruptible }, auras { id, sourceId, remainingTicks }), zonas activas (id, x, y, radiusMeters, remainingTicks), phase, safeRadiusMeters, elapsedTicks/tick del encuentro y status de la sala. Identificadores en inglés.
2. Sincronización: tras cada step, vuelca el EncounterState de core al esquema. Haz el volcado incremental (actualiza solo lo que cambió; crea y borra entidades, auras y zonas según aparezcan y desaparezcan, p. ej. xolos y zonas de Viento) para no reenviar todo cada tick. El estado de core sigue siendo la fuente de verdad; el esquema es solo una vista.
3. Eventos: los CombatEvent de cada step se difunden a todos los clientes en un solo mensaje por tick (`events`, con el array), solo si hay eventos.

Criterios (un test por punto):
1. Integración: el cliente ve cambiar la vida, la posición, el casteo con su remainingTicks bajando y las auras (p. ej. Copal o Escudo) de una entidad.
2. Los eventos de daño llegan al cliente con sourceId y abilityId.
3. Cuando aparece una zona de Viento o un xolo, el cliente los ve aparecer en el estado, y desaparecer cuando terminan o mueren (si core los retira; los cadáveres de xolos siguen con health ≤ 0).
4. Un tick sin cambios en una entidad no modifica sus campos en el esquema (comprueba que el volcado es incremental, p. ej. contando cambios recibidos).

Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T2.4 — Fin de encuentro y reinicio

```
Tarea T2.4 — Fin de encuentro y reinicio.

Lee AGENTS.md, SPEC.md (§6 "Fin del encuentro" y §10), la tarea T2.4 de PLAN.md, NOTAS.md y el código de T2.1–T2.3. Implementa SOLO T2.4.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`. Usa npm.cmd. No hagas commit. Usa solo APIs de Colyseus que existan en los tipos instalados y lístalas en el reporte con su .d.ts.

1. Fin: cuando core devuelve 'victory' o 'defeat', el status sincronizado cambia a ese valor y el bucle deja de avanzar. 5 s después (usa el reloj de la sala, no setTimeout suelto) la sala vuelve a 'lobby': se borra el encuentro, se limpian entidades/zonas del esquema y todos los jugadores conectados quedan con ready = false (conservan su classId elegido).
2. Desconexión en combate: el jugador muere. Core es puro y no tiene forma de matar a un jugador desde fuera: añade en core una función pura exportada `removePlayer(state, playerId)` que devuelve un estado nuevo con su vida en 0, sin casteo ni auras, y un evento `death` con sourceId = playerId y abilityId 'disconnect' (agrega 'disconnect' a AbilityId). Tests en core para ella (no muta, idempotente con un jugador ya muerto). El servidor la aplica antes del siguiente step y difunde el evento; si con eso mueren todos, core declara 'defeat' en ese step.
3. Desconexión en el lobby: el jugador sale de la lista (y deja libre su rol). Si en ese momento los restantes ya cumplen las condiciones de inicio, la partida NO arranca sola: hace falta otro `ready`.
4. Una sala sin clientes se cierra (comportamiento por defecto de Colyseus si existe; compruébalo en los tipos).

Criterios (un test por punto):
1. Integración: victoria → status 'victory' y, 5 s después, 'lobby' con todos ready = false. Para no esperar una pelea entera, permite (solo en tests) arrancar con el jefe a poca vida mediante opciones de creación que el servidor real no use.
2. Derrota → 'defeat' y luego 'lobby' (p. ej. sala dev de 1 jugador que muere).
3. Desconexión a media pelea: los demás reciben el evento death con abilityId 'disconnect' y la partida sigue.
4. Core: removePlayer no muta el estado de entrada y es idempotente.

Si algo es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```
