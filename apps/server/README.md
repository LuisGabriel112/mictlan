# Servidor de Mictlán

## Jugar con amigos (T4.1)

Esta guía vive aquí porque el servidor aloja tanto la partida como el cliente
compilado. Los [controles y el lobby](../client/README.md) están en la guía del cliente.

### Preparar un clon limpio

Usa Node.js 24 y npm en PowerShell, desde la raíz del repositorio:

```powershell
npm.cmd ci
npm.cmd run start
```

`start` compila el cliente con Vite y después inicia **un solo proceso de juego**
con `node --import tsx`. HTTP y WebSocket comparten `PORT`, por defecto `2567`.
Abre `http://localhost:2567`. No hace falta compilar core ni iniciar Vite aparte.
Las herramientas de build y tsx son dependencias de desarrollo: usa `npm ci`
completo, sin `--omit=dev`. Detén el servidor con Ctrl+C.

Producción siempre exige de 3 a 5 jugadores y la composición del SPEC: un Jaguar,
un Tícitl y de uno a tres Águilas. Ignora `MICTLAN_DEV_MIN_PLAYERS` aunque esté
definida en la terminal. Para cambiar el puerto antes de arrancar:

```powershell
$env:PORT = '3000'
npm.cmd run start
```

El cliente compilado usa el mismo origen: `wss://<host>` en HTTPS y `ws://<host>`
en HTTP, conservando el puerto de la página cuando existe. `?server=` tiene
prioridad y normalmente no se necesita. Las rutas sin extensión sirven
`index.html`; un archivo inexistente devuelve 404.

### Red local con Vite

En la máquina anfitriona, desde la raíz:

```powershell
$env:MICTLAN_DEV_MIN_PLAYERS = '3'
npm.cmd run dev
```

Comparte la URL **Network** que imprime Vite, por ejemplo
`http://192.168.1.20:5173`, sin `?dev=1`. El script del cliente incluye `vite --host`.
Los amigos deben estar en la misma red local; `localhost` apunta a su propia
máquina. En desarrollo, el cliente conecta al hostname de esa URL en el puerto
2567; si cambias `PORT`, indica `?server=ws://192.168.1.20:3000`.

En Windows, usa el perfil de red **Privado** en tu red de confianza. Cuando
Windows pida acceso para Node.js, permite **Redes privadas**. Si se rechazó antes,
abre Seguridad de Windows → Firewall y protección de red → Permitir una aplicación
a través del firewall → Cambiar configuración, y habilita Node.js en **Privada**.
Ambos procesos de Node (Vite y Colyseus) deben ser accesibles; no apagues el firewall.
Consulta la [guía de Microsoft](https://support.microsoft.com/en-us/windows/security/firewall/risks-of-allowing-apps-through-windows-firewall).

### Otras redes con Cloudflare Tunnel

Instala previamente `cloudflared` siguiendo la
[documentación oficial](https://developers.cloudflare.com/tunnel/get-started/).
Para un playtest, un [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
genera una URL temporal `https://…trycloudflare.com`.

1. Libera el puerto 2567 deteniendo cualquier servidor dev anterior. En una
   terminal de PowerShell, desde la raíz, ejecuta:

   ```powershell
   Remove-Item Env:PORT -ErrorAction SilentlyContinue
   npm.cmd run start
   ```

2. Comprueba que `http://localhost:2567` muestra el lobby. En otra terminal:

   ```powershell
   cloudflared tunnel --url http://localhost:2567
   ```

3. Mantén ambas terminales abiertas y comparte la URL **HTTPS** que imprime
   cloudflared, sin añadir `:2567`, `?server=` ni `?dev=1`. Si elegiste otro `PORT`,
   cambia también el puerto del comando del túnel.
4. Para validar T4.1, tres personas en **tres redes distintas** abren esa URL.
   Una pulsa **Crear sala** y comparte el código de cuatro letras; las otras
   pulsan **Unirse** con ese código. Elijan Jaguar, Tícitl y Águila y pulsen **Listo**.
5. Jueguen hasta victoria o derrota. Confirmen que los tres ven el mismo resultado
   y regresan al lobby tras cinco segundos, con clase conservada y Listo desmarcado.
   En las herramientas del navegador, la conexión WS debe usar `wss://` con el
   mismo host público. Esta es la prueba manual de aceptación de Venegas.
6. Al terminar, Ctrl+C en ambas terminales. El Quick Tunnel es temporal; comparte
   la nueva URL si lo reinicias.

### Servicio estático y Colyseus

Se usan `node:http` y `node:fs/promises`: `express` está instalado transitivamente,
pero faltan sus declaraciones TypeScript (`@types/express`). Así se conserva
`strict` sin añadir dependencias ni declaraciones incompletas de terceros.
El directorio `apps/client/dist` se resuelve desde el módulo, independientemente
del directorio de trabajo. Solo se permite leer rutas dentro de ese directorio.

Colyseus 0.18.18 registra sus listeners HTTP al completar `Server.listen()`
(`node_modules/@colyseus/core/build/Server.d.ts` y `build/Server.mjs`). Después,
el adaptador conserva esos listeners para `/matchmake` y `/__healthcheck` y
sirve el cliente en el resto. No modifica los listeners de upgrade WebSocket de
`WebSocketTransport({ server })` (`@colyseus/ws-transport/build/WebSocketTransport.d.ts`).

## T2.1 — Sala de Colyseus y lobby

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

## T2.4 — Fin de encuentro y reinicio

`removePlayer(state, playerId)` devuelve `{ state, events }`, sin mutar la entrada.
Un jugador vivo queda con vida 0 y sin casteo; `replaceCombatEntity` reutiliza la
limpieza de auras de muertos. El único evento es `death`, con `entityId` y
`sourceId` del jugador, `abilityId: 'disconnect'` y el tick actual. Un jugador
muerto, inexistente o un enemigo no cambian ni producen eventos. El siguiente
`step` decide si corresponde derrota.

`CombatSession` recibe esa función por constructor. `onLeave` elimina siempre
al jugador del roster; durante combate aplica la muerte inmediatamente, antes
del siguiente step, vuelca el esquema y difunde `events`. El cadáver permanece
en el encuentro hasta el reinicio. Durante el resultado, el encuentro queda
congelado. Una salida del lobby libera el rol, pero solo otro `ready` puede
iniciar combate.

Al terminar se programa un único `this.clock.setTimeout`, con
`BOSS.returnToLobbyDelayTicks * COMBAT_LOOP_RULES.tickMs` (5000 ms). El callback
descarta la sesión, vacía entidades y zonas, pone fase, radio y relojes en 0,
conserva clases y código, pone a todos los conectados con `ready = false` y
ejecuta `unlock()`. Una nueva partida crea otra sesión y otra cola de entradas.

**Compatibilidad comprobada:** en Colyseus core 0.18.18, `setTimestep()` sin
callback cancela el intervalo pero conserva `_simulationInterval`; por ello
`broadcastPatch()` tampoco avanza el reloj. Se sustituye el callback de combate
por uno vacío a 50 ms para mantener `this.clock` activo sin volver a ejecutar
core. El nuevo combate sustituye ese callback. No se accede a campos privados
del framework. Se comprobó en `node_modules/@colyseus/core/build/Room.mjs`,
líneas 480 y 836, y mediante el regreso real al lobby en integración.

`autoDispose` se conserva en su valor predeterminado `true`. Colyseus cierra la
sala vacía y limpia sus relojes; `onDispose` libera el código mediante el pool
existente. Las pruebas verifican la reutilización del código al abandonar una
sala en lobby, combate o victoria, incluso con el reinicio pendiente.

`RaidServerOptions.initialBossHealth` permite empezar con poca vida del jefe
solo mediante la inyección del servidor en tests. Sigue el tercer parámetro de
`createRaidServer` y llega a `RaidDependencies`; no cambia la vida máxima ni
acepta opciones enviadas por el cliente. No se añadieron dependencias.
