# T2.1 — Sala de Colyseus y lobby

Desde la raíz, `npm.cmd run dev --workspace @mictlan/server` arranca HTTP y WebSocket
en `PORT` (2567 por defecto). Core se consume como TypeScript mediante su export
`@mictlan/core`; no requiere compilarse antes de ejecutar tsx o Vitest.

El cliente crea con `client.create('raid')`, obtiene `room.state.code` y comparte
ese código. Los demás entran con `client.joinById(code)`. `roomId` es el propio
código de cuatro letras A–Z: los tipos 0.18 permiten sustituirlo en `onCreate`.
Un registro por servidor reserva los códigos de forma síncrona, resuelve las
colisiones recorriendo el espacio restante y los libera en `onDispose`. Garantiza
unicidad entre las salas activas de este servidor en un proceso; un despliegue
con varios procesos necesitaría un registro compartido.

`ready { classId }` valida la composición contando solo a los demás jugadores
listos. Un rechazo conserva el estado anterior y se envía únicamente al emisor.
Todos los conectados deben estar listos para iniciar. Al iniciar se guarda un
único `EncounterState`, se usa el `sessionId` como id del jugador y se bloquean
nuevas entradas. El bucle de combate corresponde a T2.2.

`MICTLAN_DEV_MIN_PLAYERS` acepta enteros de 1 a 3 (por defecto 3; cualquier valor
inválido vuelve a 3). Por debajo de 3 se omiten los mínimos de clase, conservando
los máximos, y se activa `devMode` en core. Estas opciones y la semilla provienen
del servidor mediante dependencias inyectadas; los clientes no pueden cambiarlas
en las opciones de creación. La semilla se obtiene de un entero aleatorio de
32 bits. `schema()` evita decoradores; schema 5 incluye su declaración de
`Symbol.metadata`, así que el tsconfig solo necesita añadir `types: ["node"]`.

## APIs comprobadas en los paquetes instalados

Rutas relativas a `node_modules/`. Versiones: core 0.18.18, ws-transport 0.18.4,
schema 5.0.36 y sdk 0.18.5. También se consultaron los README de los cuatro paquetes.

| Uso | Declaración comprobada |
| --- | --- |
| `Room<{ state: LobbyState }>`, `state`, `maxClients`, `roomId` (getter/setter), `onCreate`, `onJoin`, `onLeave`, `onDispose`, `onMessage<unknown>`, `lock()` | `@colyseus/core/build/Room.d.ts`: 128, 175, 233, 330–337, 346–372, 442, 670, 746 |
| `Client.sessionId`, `Client.send()` | `@colyseus/core/build/Transport.d.ts`: 145, 191 |
| `Server`, opciones `transport`, `greet`, `gracefullyShutdown`; `define()`, `listen()`, `gracefullyShutdown(false)` | `@colyseus/core/build/Server.d.ts`: 13–82, 102, 122, 165, 171 |
| `WebSocketTransport({ server })` | `@colyseus/ws-transport/build/WebSocketTransport.d.ts`: 16, 49; `server` heredado de `@types/ws/index.d.ts`: 336 |
| `schema()`, constructor con propiedades iniciales, `SchemaType` | `@colyseus/schema/build/annotations.d.ts`: 156–185 |
| `t.string<T>()`, `t.boolean()`, `t.map()`, `.default()` | `@colyseus/schema/build/types/builder.d.ts`: `FieldBuilder.default`, `PrimitiveFactory`, `MapFactory` y declaración de `t` |
| Mapa sincronizado: `set`, `get`, `delete`, `has`, `values`, `size` | `@colyseus/schema/build/types/custom/MapSchema.d.ts`: 77–110 |
| SDK `Client`, constructor, `create<LobbyState>()`, `joinById<LobbyState>()` | `@colyseus/sdk/build/Client.d.ts`: 69, 83, 89 y alias `Client` al final |
| SDK `Room<unknown, LobbyState>`, `roomId`, `sessionId`, `state`, `send`, `onMessage`, `leave` | `@colyseus/sdk/build/Room.d.ts`: 13–16, 99–107, 156 |
| Consulta de la sala en los tests: `matchMaker.getLocalRoomById()` | `@colyseus/core/build/MatchMaker.d.ts`: 149 |

## Validación

Los escenarios están en `tests/features/T2.1.feature` y
`packages/core/tests/features/T2.1.feature`. Los tests de integración usan HTTP y
WebSocket reales en `127.0.0.1`, puerto 0 asignado por el sistema, y cierran clientes
y servidor al terminar. Las pruebas unitarias de reglas no usan red; las del
arranque sustituyen HTTP, transporte y servidor por mocks.

Los casos C1, C2, C3 y C5 están identificados en `tests/lobby.integration.test.ts`;
C4 está en `packages/core/tests/dev-encounter.test.ts`. `npm.cmd run check` incluye
typecheck, lint sin excepciones y tests de ambos workspaces.

La revisión T2.1 midió 100 % de líneas ejecutables nuevas con el profiler V8 de
Node y mapas de fuente, sin instalar proveedores de cobertura. Ocho mutaciones
dirigidas fueron detectadas por aserciones: escalado del jefe, mínimo normal,
escalado de xolos, máximos de composición, todos listos, activación de devMode,
colisiones de códigos y transición ready. El código nuevo cumple complejidad ≤6,
anidamiento ≤2, funciones ≤20 líneas y archivos ≤500 líneas. Las funciones
preexistentes `groupInputs` y `step` de core exceden respectivamente complejidad
y longitud; no se modificaron porque pertenecen a tareas anteriores.

El análisis de duplicación no encontró bloques repetidos de 50 tokens o más en
los nueve módulos de lógica revisados. La medición V8 y las comprobaciones
dirigidas quedan como artefactos locales ignorados en `coverage/T2.1/`.

La prueba adicional de `npm.cmd run dev --workspace @mictlan/server` en esta
sandbox abortó dentro de tsx (`os.userInfo`, `uv_os_get_passwd: ENOMEM`), antes de
importar el proyecto. Requiere repetir ese comando en el entorno local de
Venegas. Las pruebas de integración verifican el arranque HTTP+WS real con Vitest.

## T2.3 — Estado sincronizado y eventos

`LobbyState` conserva `code`, `players` y `status` y añade `entities`, `zones`,
`phase`, `safeRadiusMeters`, `elapsedTicks` y `tick`. Las entidades y zonas son
mapas por `id`; las auras de cada entidad son un mapa por `definition.id`, igual
que la identidad usada por core para refrescarlas. `CombatState.ts` define los
esquemas mediante `schema({...})` y `t.*`, sin decoradores.

| Valor de core | Representación sincronizada |
| --- | --- |
| `classId: null` de enemigos | `classId: ''` |
| `targetId: null`, también dentro de un casteo | `targetId: ''` |
| Enemigos sin maná y jugadores no sanadores | `mana: 0`, `maxMana: 0` |
| Maná de sanadores | Valor decimal de core, sin redondeo |
| `cast: null` | Referencia opcional `cast: undefined`, también al eliminarse en el cliente |
| Lobby sin encuentro | Mapas vacíos, fase, radio y relojes en `0` |

Un casteo presente contiene `abilityId`, `targetId`, `durationTicks`,
`remainingTicks` e `interruptible`. Cada aura expone `id`, `sourceId` y
`remainingTicks`. Cada zona expone `id`, `x`, `y`, `radiusMeters` y
`remainingTicks`. Las posiciones y radios siguen en metros; los dos relojes son
ticks de core: `tick` cuenta desde la creación y `elapsedTicks` desde el pull.

`syncEncounter(view, encounter)` es un adaptador sin red que solo lee core.
`projection.ts` compara los campos antes de asignarlos y reconcilia colecciones
con fábricas inyectadas, conservando las instancias existentes. Se eliminan
entradas solo cuando dejan de existir en core: un cadáver de xolo permanece si
core lo conserva. No se filtran entidades por vida ni se recalculan reglas.

La sala vuelca el estado al iniciar, antes del primer timestep, y una vez tras
cada `advance` cuyo `tick` cambió. Core incrementa `tick` en cada step; una
fracción de tick no causa volcado. Se sincroniza también el último step del
encuentro antes de detener el bucle. El mock terminal de `combat-room.test.ts`
ahora respeta ese incremento, como el step real.

Cada `advance` con eventos llama una sola vez a `broadcast('events', events)`;
el payload es el array completo, en el orden producido por core, sin envoltorio
ni filtrado. Un array vacío no se difunde. Los parches de estado conservan la
cadencia propia de Colyseus; no hay una garantía adicional de orden entre el
mensaje de eventos y el parche del estado.

### APIs instaladas utilizadas por T2.3

Versiones verificadas: `@colyseus/schema` 5.0.36 y `@colyseus/core` 0.18.18.
Rutas relativas a `node_modules/`:

| API | Declaración `.d.ts` |
| --- | --- |
| `schema`, constructor con propiedades iniciales, `SchemaType` | `@colyseus/schema/build/annotations.d.ts`: 156, 161, 185 |
| `t.string<T>`, `t.number<T>`, `t.boolean`, `t.map`, `t.ref` | `@colyseus/schema/build/types/builder.d.ts`: 212, 222, 245, 261–288 |
| `FieldBuilder.default`, `FieldBuilder.optional` | `@colyseus/schema/build/types/builder.d.ts`: 89, 182 |
| `MapSchema.get`, `set`, `delete`, `keys`; tests: `has`, `size` | `@colyseus/schema/build/types/custom/MapSchema.d.ts`: 77–78, 96, 105, 108, 110 |
| `Schema.toJSON` (solo para observar asignaciones en tests) | `@colyseus/schema/build/Schema.d.ts`: 144 |
| `Room.setTimestep` (conexión existente), `Room.broadcast` | `@colyseus/core/build/Room.d.ts`: 518, 690 |
| SDK `Room.onMessage<CombatEvent[]>`, `send` (integración) | `@colyseus/sdk/build/Room.d.ts`: 100–107 |

### Verificación T2.3

Los escenarios revisables están en `tests/features/T2.3.feature`. Las pruebas
se escribieron y fallaron antes de implementar el volcado y la difusión.
`schema-projection.test.ts`, `schema-sync.test.ts` y `schema-room.test.ts`
prueban cada función de sincronización y la conexión con la sala, con reloj,
step y broadcast inyectados o sustituidos. `schema.integration.test.ts` verifica
C1 y C2 con dos clientes reales. C3 y C4 se verifican sin red en
`schema-sync.test.ts`, incluyendo cero asignaciones y cero escrituras de mapa
cuando solo avanza el reloj.

El profiler V8 con mapas de fuente midió 100 % de líneas ejecutables en los
cuatro módulos de esquema y `RaidRoom.ts`. ESLint verificó complejidad ≤6,
anidamiento ≤2, funciones ≤20 líneas y archivos ≤500 líneas en el código de
T2.3 y sus pruebas. El análisis de duplicación no encontró bloques repetidos de
50 tokens o más en los 15 módulos revisados. Los artefactos locales de estas
comprobaciones están ignorados en `coverage/T2.3/`.

Se detectaron 14/14 mutaciones mediante aserciones: comparación de campos,
identidad de instancias, escrituras redundantes, bajas de mapas, maná, borrado y
progreso de casteos, identidad de aura, progreso de zona, reloj desde el pull,
volcado inicial y posterior al step, silencio sin eventos y lote completo.
`npm.cmd run check` pasó con 456 tests de core y 130 de servidor, sin dependencias
nuevas. El reinicio y las desconexiones de T2.4 quedan fuera de esta tarea.
