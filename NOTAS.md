# NOTAS — Bitácora del flujo Claude + Codex

## Estado al 2026-10-07

| Tarea | Commit | Rebotes | Notas |
|---|---|---|---|
| T0.1 Monorepo | `5cceb36` | 1 | Test frágil (apps vacías), tipos de Node en core/src, tests en dos carpetas, `check` con pre/post hooks |
| T1.1 Tipos y datos | `4831429` | 0 | — |
| T1.2 RNG, reloj y movimiento | `1ecd209` | 0 | — |
| T1.3 Habilidades | `bcbe8ad` | 0 | Primer intento matado por falta de memoria del sistema; relanzado sin cambios |
| T1.4 Daño, curación, muerte y Vuelo | `072e443` | 0 | Se detuvo una vez: su `npm ci` borró `node_modules` y la sandbox no tiene red. Venegas reinstaló y se reanudó |
| T1.5 Amenaza | `c426820` | 0 | — |
| T1.6 Auras | `70aaafe` | 0 | Incluye la corrección de Provocar con muertos |
| T1.7 IA de enemigo y jefe | `0d2199b` | 0 | Incluye el auto-ataque del Jaguar, que no estaba en ninguna tarea |
| T1.8 Fases y enfurecer | `1350afa` | 0 | Intento en la PC del trabajo sin commit; luego límite de uso de Codex (se esperó al reinicio de cuota). El proceso de Codex murió durante su `npm run check` final, sin reporte; Claude revisó lo escrito directamente |
| T1.9 Viento e interrupción | `a38ec0f` | 0 | Primera tarea con `--effort high` (para ahorrar cuota); sin problemas |
| T1.10 Xolos | `ac1ac9f` | 0 | `--effort high`; sin problemas |
| T1.11 Arena y fin del encuentro | `c50f946` | 1 | Codex detectó una contradicción en SPEC §10 (Viento tras la muerte del jefe contra encuentro congelado); se corrigió el SPEC. El `--resume` falló por tareas fantasma del plugin y se terminó con `--fresh` |
| T1.12 Simulador: bots y runner | `aa7a367` | 0 | `--effort high`; sin problemas |
| T1.13 Simulador: reporte y CLI | `e541b30` | 0 | **Implementada por Claude** a pedido de Venegas (Codex con 4 % de cuota). Sin revisión independiente |
| T2.1 Sala de Colyseus y lobby | `bf89574` | 0 | `xhigh`, 27 min. Verificó cada API de Colyseus en los `.d.ts`. Su sandbox no pudo correr `npm run dev` (ENOMEM en tsx); Claude lo corrió fuera y responde HTTP 200 |
| T2.2 Bucle de combate y entradas | `8fcdca6` | 0 | **Implementada por Claude** a pedido de Venegas (Codex con 25 % de cuota). Sin revisión independiente. 11/11 mutaciones detectadas |
| T2.3 Estado sincronizado y eventos | `6048c75` | 0 | `xhigh`, 10 min |
| T2.4 Fin de encuentro y reinicio | `ecd357f` | 1 | Primer intento abortado a los 30 s (forwarder en segundo plano); relanzado con `--wait`, 20 min. Claude recortó de README el reporte de tarea que Codex pegó ahí |
| T3.1 Escena base | `bbdecd0` | 0 | **Implementada por Claude** (Codex sin créditos). Verificada por Claude en Chrome con 2 pestañas; falta que Venegas confirme la fluidez |
| T3.2 Objetivo y barra de acción | `bbdecd0` | 0 | **Implementada por Claude**. Verificado en Chrome: Tab, clic, 2 (Disparo veloz: −70 al jefe), F5 bloqueado, barra en gris al morir |
| T3.3 Marcos y barras de casteo | `f3445f7` | 0 | **Implementada por Claude**. Verificado en Chrome: marcos propio/objetivo/grupo, clic en marco de grupo, F1, barra del jefe con borde turquesa en el Lamento. La barra de casteo propia no se pudo capturar (ventana oculta) |
| T3.7 Movimiento con clic derecho | `5600940` | 0 | Pedida por Venegas e **implementada por Claude**. Verificada en Chrome: clic derecho, llegada, y Flecha lanzada a media caminata (−140 al jefe) |
| T3.4 Lectura del combate | `6462217` | 2 | Primera tarea con `gpt-6.1-sol` (`high`, 30 min). Rebotes: línea de muerte redundante con entorno/propia entidad y reporte pegado en el repo; luego, tras la prueba de Venegas, nombre corto del jefe ("Mictlantecuhtli", solo en cliente) y log semitransparente de 400 px. Verificada por Venegas en navegador; fase 3 y Viento quedan para el playtest |

Siguiente: **T3.5** (lobby), luego T3.6 (pulido visual) y T4.1 (playtest). Prompts listos en `PROMPTS.md`; lanzarlos con `/codex:rescue --wait --fresh --model gpt-6-astra --effort xhigh` (T3.5) o `--model gpt-6.1-sol --effort high` (T3.6, T4.1).

**Para continuar en otra máquina:**
1. `git pull` y `npm.cmd ci` (instala también Phaser, Vite y el SDK del cliente).
2. `npm.cmd run check` debe dar 788 tests en verde (464 core, 177 servidor, 147 cliente).
3. Jugar: `npm.cmd run dev` y abrir la URL que imprima Vite con `?dev=1&class=eagle` (o `jaguar` / `healer`). Controles en `apps/client/README.md` (clic derecho, S, Q W E R, Tab, F1–F5).
4. En Claude Code: "lee NOTAS.md y lanza T3.5 con PROMPTS.md". Si Codex no tiene créditos, Claude puede implementarla (T3.1–T3.3 y T3.7 las hizo Claude).

## Configuración de Codex

- `~/.codex/config.toml` traía `model = "gpt-5.2"`, que falla con cuenta de ChatGPT (HTTP 400).
- Se delega con `--model gpt-6-astra --effort xhigh`.
- PowerShell bloquea `npm.ps1`: usar `npm.cmd`.
- La sandbox de Codex no tiene red: prohibirle `npm ci` y `npm install` en cada prompt.
- Si un proceso de Codex muere (memoria, cuota), el plugin deja la tarea como `running` para siempre y bloquea `--resume` (`/codex:cancel` falla porque el PID ya no existe). Solución usada: relanzar con `--fresh` explicando el trabajo a medias. Si el forwarder lanza Codex en segundo plano y termina antes, la sesión de Codex se aborta a los ~30 s (`turn_aborted` en `~/.codex/sessions/...rollout-*.jsonl`) y queda otra tarea fantasma (T2.4, `task-muylymkv-qzjqif`): pedir siempre `--wait` (primer plano). Tareas fantasma actuales: T1.3 (`task-muw6znbj-g1m1rs`) y T1.8 (`task-muxk6sfg-950ogi`) en `%TEMP%\codex-companion\mictlan-*\state.json`.

## Decisiones tomadas fuera del SPEC (ya implementadas)

**T1.2**
- Los jugadores aparecen ordenados por id (comparación de strings con `<`, no `localeCompare`).
- El muro recorta el **centro** del jugador a 20 m (no se resta el radio de cuerpo).
- El estado del RNG (mulberry32) vive en `EncounterState.rngState`.
- `createEncounter` exige 3–5 jugadores.

**T1.3**
- Orden de un tick: (a) bajan GCD, cooldowns y casteo, regenera maná y se resuelven los casteos que llegan a 0; (b) por jugador en orden de id: `target` → último `move` → `cast`.
- Con varios `cast` en el mismo tick vale el **primero**.
- Habilidad `ally` sin objetivo → `invalid_target` (no hay auto-objetivo propio).
- Un casteo que falla al resolverse emite `castCancelled` con motivo `invalid_target` u `out_of_range`.
- El maná se calcula en unidades enteras de 1/20 para evitar deriva.

**T1.4**
- Las cantidades se calculan con `BigInt` sobre puntos base y se redondea una sola vez al final.
- Los efectos se aplican al momento de `abilityResolved`, dentro del mismo tick; un objetivo que muere antes invalida las acciones posteriores del tick.
- El crítico consume una tirada del RNG por objetivo, aunque `critChance` sea 0.
- `target` hacia una entidad muerta se ignora.
- Al morir, el casteo en curso se borra **sin** emitir `castCancelled`.
- El recorte al muro se movió a `movement.ts` y lo comparten el movimiento y Vuelo.
- Codex agregó un Gherkin en `packages/core/tests/features/` por su cuenta.

**T1.5**
- Orden del tick: al inicio bajan los temporizadores de Provocar; al final del tick, tras todos los jugadores, se reevalúa el objetivo de cada enemigo (una sola vez).
- La amenaza es decimal (la curación se reparte sin redondear). Los umbrales se comparan en bps.
- Un objetivo actual con amenaza igual al máximo se conserva (histéresis).
- Provocar tomaba como "máxima actual" las entradas de jugadores muertos. Corregido en T1.6: solo cuentan los vivos.
- La amenaza se acumula antes del pull; T1.7 decide qué pasa con ella.

**T1.6**
- Las auras avanzan al inicio del tick, antes de los casteos; el último pulso de Copal ocurre en el tick en que expira.
- Escudo activo exactamente 120 ticks: desde el tick en que se aplica hasta 119 ticks después.
- Aplicar un aura **no emite evento**. El log de combate (T3.4) puede necesitar un evento `auraApplied`.
- Copal sigue curando si el sanador muere, pero esa curación ya no genera amenaza.

**T1.7**
- Orden del tick: auras y Provocar → casteos de jugadores → inputs → auto-ataque del Jaguar → pull → `updateEnemyTargets` → enemigos en orden de id (casteo y temporizadores del jefe → persecución → auto-ataque).
- El tick del pull cuenta como `elapsedTicks = 1`. El primer Golpe empieza con `elapsedTicks = 200` (199 ticks después del tick del pull). T1.8 debe respetar la misma convención para los 10 s de cada fase.
- Pull: cualquier amenaza > 0 de un jugador vivo, o un jugador vivo a ≤ 10 m (centros − radio del jefe).
- Auto-ataques: el temporizador baja hasta 0 y espera ahí; el primer golpe sale al entrar en alcance. No hay auto-ataque mientras se castea.
- Una habilidad con temporizador en 0 entra a la cola y conserva el orden; su intervalo se reinicia al empezar de verdad.
- Viento, Lamento y Llamado de los xolos se programan y emiten eventos, pero aún no tienen efectos (T1.9 y T1.10).
- Viento (sin casteo) emite `castStarted` con duración 0 y `abilityResolved`.

**T1.8**
- El cambio de fase se evalúa al final del tick, después de las acciones de los enemigos; `phaseElapsedTicks` queda en 0 y el siguiente tick cuenta como 1 (misma convención que el pull).
- El enfurecer se activa tras `advanceBossEncounter` y antes de las acciones de los enemigos, así que el daño del jefe en el tick 9600 ya sale enfurecido.
- Nuevo evento `enraged` con `sourceId` del jefe.
- El enfurecer es un modificador más dentro de `calculateDamage` (un solo floor junto con armadura y Escudo).

**T1.9**
- Las zonas bajan y explotan después de inputs, auto-ataque del Jaguar y enfurecer, y antes de las acciones de los enemigos. Una zona marcada en el tick t explota en t + 40; el movimiento de ese mismo tick ya cuenta para esquivarla.
- La selección de objetivos del Viento consume una tirada del RNG por zona, sobre los jugadores vivos ordenados por id.
- El daño del Viento sigue atribuido al jefe aunque haya muerto (y lleva enfurecer si estaba activo).
- Grito valida `not_casting` justo después del paso 6 (objetivo) y antes del 7.
- Para aislar Copal, los tests de auras ponen `bossActive = true` con temporizadores vacíos (si no, la curación provoca el pull y el Viento contamina los totales).

**T1.10**
- Ids `xolo:N`, saltando cualquier id ocupado (incluidos cadáveres y jugadores).
- Una sola tirada del RNG por Llamado: el primer ángulo; el resto se reparte a 360°/count (con 2, opuestos).
- La vida escala con el tamaño del grupo configurado, no con los vivos.
- Los xolos actúan desde el tick siguiente a su aparición.

**T1.11**
- Orden al final del tick: enemigos → arena → cambio de fase → fin. El daño de arena usa el radio de la fase actual antes de que una entrada de fase reinicie el reloj.
- El daño de arena se aplica directo con `applyDamage` (sin mitigación, RNG, enfurecer ni amenaza), con `sourceId: 'environment'`.
- `death` lleva `sourceId` y `abilityId` del golpe letal.
- Tras `victory` o `defeat`, `step` solo incrementa `tick`.
- SPEC §10 corregido: si el jefe muere, solo explotan los círculos que vencen en ese tick; los demás quedan congelados.
- Varios tests viejos que mataban al jefe para probar otra cosa ahora matan a un xolo, para que el encuentro no termine.

**T1.12**
- Los parámetros de los bots viven en `src/data/simulation.ts` (`SIMULATION_RULES`) y se exportan desde core; no son números de balance del juego.
- Prioridad del sanador: Ofrenda → Gran remedio → Copal → Remedio (emergencias primero).
- Solo el tanque se acerca antes del pull; los demás esperan sin actuar hasta que el jefe está activo.
- Al estar exactamente en el centro de una zona, el bot escapa hacia el centro de la arena.
- `sim/` queda cubierto por typecheck vía `tsconfig.test.json`.

**T1.13** (Claude)
- `npm run sim` compila `src/` y `sim/` con `tsconfig.sim.json` a `packages/core/dist/` (ya ignorado) y lo corre con `node`. Sin dependencias nuevas.
- Semillas 1..runs. Duración = `elapsedTicks` (desde el pull).
- DPS/HPS por jugador de cada clase: total de la clase / (tiempo de combate × jugadores de esa clase), sumado sobre todos los intentos. HPS usa curación efectiva.
- Muertes: solo de jugadores, agrupadas por el `abilityId` del evento `death`.
- Cambios de objetivo del jefe: ticks en que pasa de un jugador a otro (la primera adquisición no cuenta). Lo calcula el runner (`bossTargetChanges`).

**T2.2**
- El bucle usa `setTimestep` de Colyseus (cada 50 ms, con el delta medido) y un acumulador propio y puro (`combat-clock.ts`): un `step` por cada 50 ms acumulados, máximo 5 por llamada; si se alcanzan 5, el sobrante se descarta.
- `CombatSession` encapsula encuentro, cola de entradas y reloj; la sala solo la conecta. `RaidRoom.encounter` ahora es un getter del estado de la sesión.
- Entradas: `move` exige números con longitud finita y se normaliza (0,0 se respeta); `target` acepta string o null; `cast` acepta solo ids de habilidades de jugador (core ignora las de otra clase). Máximo 16 entradas por jugador por tick; las que sobran se descartan.
- Solo se aceptan entradas de jugadores del encuentro y mientras `status` sea `combat`.
- Al terminar (victory/defeat) el bucle se detiene y el `status` del lobby refleja el resultado; el regreso al lobby es T2.4.
- `critChance` se inyecta solo en tests, por un tercer parámetro de `createRaidServer`; el servidor real usa el valor por defecto de core.

**T2.3**
- El estado de combate vive en el mismo `LobbyState` (entities, zones, phase, safeRadiusMeters, elapsedTicks, tick); `status` sale del encuentro.
- Ausencias: `classId` y `targetId` vacíos (`''`), maná 0/0 para quien no es sanador, `cast` opcional (`undefined` sin casteo). Documentado en apps/server/README.md.
- Volcado incremental (`schema/projection.ts`): solo asigna campos que cambiaron y crea o borra entradas de mapas. Se vuelca al iniciar y tras cada `advance` que avanzó el tick.
- Eventos: un mensaje `events` por `advance` con eventos (puede juntar varios ticks si el bucle se atrasó).

**T2.4**
- `removePlayer(state, playerId)` en core: vida 0, sin casteo (las auras se limpian por la regla de muertos) y evento `death` con `abilityId: 'disconnect'`. Idempotente.
- `onLeave` siempre saca al jugador de la lista; en combate lo mata al momento, vuelca el esquema y difunde el evento. En el lobby ya no se intenta arrancar la partida.
- Al terminar, `this.clock.setTimeout` de 5 s (`returnToLobbyDelayTicks × 50`) devuelve la sala al lobby: limpia combate, `ready = false` (conserva `classId`) y `unlock()`.
- Colyseus 0.18.18: `setTimestep()` sin callback deja `_simulationInterval` asignado y el reloj de la sala deja de avanzar. Por eso, al terminar se pone un callback vacío a 50 ms.
- `RaidServerOptions.initialBossHealth`: solo para tests.

**T3.1 y T3.2**
- Cliente: Vite 8 + Phaser 3.90 (no Phaser 4: API estable y conocida; se importa con `import * as Phaser`, porque su ESM no tiene export por defecto) + `@colyseus/sdk`. Usa los datos de `@mictlan/core` (nombres, radios, alcances, costos).
- Toda la lógica está en módulos puros con tests (parámetros, conexión, proyección, WASD, interpolación, colores, teclado, objetivos, barra de acción, textos). La escena de Phaser solo dibuja y conecta; se verificó a mano en Chrome.
- **Cambio en el servidor:** `move` pasó a ser sostenido (SPEC §10, v0.6). Antes se consumía un solo tick, así que mantener una tecla no movía de forma continua.
- **Cambio en el servidor:** el esquema expone `gcdRemainingTicks` y `cooldowns` por jugador.
- WASD se lee de eventos `keydown`/`keyup` de la ventana, no del bucle de dibujo; al perder el foco se sueltan todas las teclas, para que el movimiento no quede pegado.
- Vista: 1 m = 32 px con zoom para que quepa la arena; norte arriba. HUD en una segunda cámara.
- Orden de aliados (F1–F5 / Shift+1–5): uno mismo primero y luego los demás por id. Tab: enemigos vivos del más cercano al más lejano.
- `npm run dev` (raíz) levanta servidor y cliente con `MICTLAN_DEV_MIN_PLAYERS=1` por defecto.
- El test de integración C1 de T2.3 tenía un margen de 5 s que fallaba con la CPU saturada (el bucle descarta ticks atrasados); se amplió a 10 s.

**T3.3**
- Marcos: propio (arriba a la izquierda), objetivo (a su derecha, con su barra de casteo) y grupo (columna izquierda, hasta 5, clicables). El orden del grupo es el mismo que F1–F5 (`partyOrder`).
- Barras de casteo: la propia sobre la barra de acción y la del jefe arriba al centro. Borde turquesa grueso si es interrumpible y gris fino si no.
- Vida mostrada sin negativos; vida en rojo bajo 35 %.
- Los textos de vida de T3.2 se reemplazaron por los marcos.

**T3.7 (decidido por Venegas: sin WASD, castear detiene, Claude implementa)**
- El servidor guarda órdenes de movimiento por jugador (`MovementOrders`): dirección sostenida (`move`) o destino (`moveTo`), y `stop`. Cada tick convierte el destino en un `move` hacia él; al quedar a menos de 0.35 m lo olvida. Destinos fuera del muro se recortan al muro.
- Pedir una habilidad con `castTicks > 0` llama a `stop` antes del siguiente tick: el casteo empieza en vez de rechazarse por `moving`. Vuelo y demás instantáneas no detienen.
- Cliente: clic derecho = `moveTo` y marca turquesa; S = `stop`; se desactiva el menú contextual del navegador sobre el juego. Se borró `move-input.ts` (WASD).
- `move` sigue existiendo en el protocolo (tests y bots del simulador).
- Teclas de habilidades: **Q W E R** (pedido de Venegas); los números ya no castean. F1–F5 y Shift+1–5 siguen seleccionando aliados.

## Decisiones de Venegas (2026-10-06)

- **Vuelo:** entra en T1.4. Detalle en SPEC §5.3 (v0.3).
- **Modo dev con 1–2 jugadores:** `devMode` en `EncounterConfig`, con valores de 3 jugadores. Se implementa en T2.1. SPEC §6 y §7 (v0.3).
- **Orden:** se sigue el PLAN tal cual (sin corte vertical).

## Decisiones de Claude (delegadas por Venegas, 2026-10-06)

- **Provocar ignora a los jugadores muertos** al calcular la "máxima actual". Motivo: un muerto no genera amenaza (SPEC §3) y no debería inflar la del tanque. Se corrige dentro de T1.6.
- **Se mantiene el orden del PLAN** (sin corte vertical). Motivo: el esquema sincronizado de T2.3 incluye auras, zonas, fase y radio seguro; hacer el servidor antes del motor obligaría a rehacerlo. El simulador (T1.13) es el primer punto para ver un combate completo.
- **`.gitattributes`** con `* text=auto eol=lf`, agregado por Claude (configuración, no es tarea del plan).

## Preparación de T1.9–T1.13 (Claude, 2026-10-06)

- Los prompts de T1.8 a T1.13 están en `PROMPTS.md`, con las ambigüedades ya resueltas.
- SPEC v0.4 agrega §10 "Aclaraciones de implementación" (sin cambiar números): Viento (centro dentro del círculo, RNG sin repetir, zonas que explotan aunque cambie la fase), Lamento e interrupción, xolos sobre el muro, fórmula del radio seguro, daño de arena como `environment`, `step` inerte tras el fin y golpe letal en `death`.
- PLAN: T1.9 incluye `interruptible: false` para jugadores y quitar `castStarted` a las habilidades del jefe sin casteo. T1.11 incluye el golpe letal en `death`.
- T1.13: no hay `tsx`; el simulador se compila con `tsc` y se corre con `node` (sin dependencias nuevas).
- Estimación de balance (antes del simulador): con 3 jugadores, ~105 DPS contra 24 000 de vida ≈ 3.8 min; con 5, ~265 DPS contra 50 000 ≈ 3.1 min. Quedan algo por debajo de la meta de 4–7 min; se ajusta en el Checkpoint A.

## Checkpoint A (2026-10-06, Claude; Venegas delegó la decisión)

Unas 1 500 peleas simuladas: bots perfectos y un modelo "humano" desechable (fuera del repo) que pierde acciones, no esquiva algunos Viento y falla interrupciones. La duración y el escalado son fiables; la dificultad es solo orientativa.

| Jugadores | Duración (bots) antes → después | Victorias, grupo promedio | Victorias, grupo flojo |
|---|---|---|---|
| 3 | 5:25 → 5:25 | 100 % | 98 % |
| 4 | 4:36 → 5:09 | 100 % | 66–78 % |
| 5 | 4:25 → 4:56 | 98 % | 30–38 % |

- **Aplicado (SPEC v0.5):** vida del jefe con 4 jugadores 36 000 → 40 000 y con 5, 50 000 → 56 000, para igualar la duración entre tamaños de grupo.
- **Para el Checkpoint B (no aplicado):** con buen juego nadie muere y el enfurecer nunca llega. Los grupos de 5 son mucho más frágiles ante errores (daño a todos con un solo sanador). Los xolos casi no pesan. Candidato medido: Viento 200 → 250 y Lamento 250 → 300 (grupo promedio: 96 / 74 / 68 % de victorias). Un paquete más agresivo (auto-ataque 80, xolos 40) se pasa: el grupo promedio de 5 baja al 16 %.

## Preparación de la Fase 2 (Claude, 2026-10-06)

- Dependencias instaladas por Claude en `apps/server` (Codex no tiene red): `@colyseus/core` 0.18, `@colyseus/schema` 5, `@colyseus/ws-transport` 0.18 (trae `express`); de desarrollo, `@colyseus/sdk` 0.18, `vitest` 4.1 y `tsx` 4. npm 11 bloqueó los scripts de instalación de `esbuild` y `msgpackr-extract`: `tsx` funciona igual y el otro es opcional.
- Colyseus 0.18 / schema 5 son recientes: cada prompt exige usar solo APIs de los tipos instalados y listarlas con su `.d.ts`.
- El servidor importa core por `exports` → `./src/index.ts` (sin build de core); lo ejecutan `tsx` y `vitest`.
- `check` debe cubrir core y server (scripts raíz con `--workspaces`).
- Desconexión en combate: nueva función pura de core `removePlayer(state, playerId)` con `death` y `abilityId: 'disconnect'` (T2.4).
- Opciones de sala solo para tests (semilla, critChance, jefe a poca vida) para que las pruebas sean deterministas y rápidas.

## Decisiones pendientes (de Venegas)

Ninguna.

## Recordatorios para los próximos prompts

- **Todas:** `step` reutiliza por referencia las entidades sin cambios; está prohibido mutar el estado.
- **T2.2:** un `move` con `NaN` o `Infinity` deja la posición en `NaN`; el servidor debe validarlo.
