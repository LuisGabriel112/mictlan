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
