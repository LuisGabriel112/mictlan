# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --fresh --model gpt-6-astra --effort high` seguido del texto del bloque.
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

**Dependencias de la Fase 2 (ya instaladas por Claude; Codex no tiene red):** en `apps/server`, `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express` y `ws`); de desarrollo, `@colyseus/sdk` 0.18 (cliente, también para tests en Node), `vitest` 4 y `tsx` 4. npm bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`; `tsx` funciona igual y `msgpackr-extract` es una aceleración opcional.

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
