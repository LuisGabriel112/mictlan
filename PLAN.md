# MICTLÁN — Plan de implementación

**Reglas del plan**
- Codex implementa **una tarea a la vez**, en orden. Claude revisa y marca el estado.
- Estados: `[ ]` pendiente · `[~]` en curso · `[x]` hecha · `[!]` bloqueada (anotar motivo).
- Una tarea está terminada solo si cumple **todos** sus criterios y `npm run check` pasa.
- La fuente de verdad de reglas y números es `SPEC.md`. Si hay conflicto, gana el SPEC.
- En los tests de core se usa `critChance: 0` salvo que el criterio pida probar el crítico.

---

## Fase 0 — Base del proyecto

### [x] T0.1 Monorepo
- **Archivos:** `package.json` raíz, `tsconfig.base.json`, `packages/core/*`, `apps/server/`, `apps/client/` (vacías salvo `package.json`), `.gitignore`, `.editorconfig`, configuración de ESLint.
- **Hacer:** npm workspaces, TypeScript `strict`, Vitest en `packages/core`, y los scripts raíz `test`, `typecheck`, `lint` y `check` (= typecheck + lint + test). ESLint con `no-restricted-globals` / `no-restricted-syntax` que prohíbe `Date`, `Math.random`, `setTimeout`, `setInterval`, `fetch`, `window` y `document` **solo** en `packages/core/src`.
- **Criterios:**
  - `npm install` y `npm run check` funcionan en Windows (PowerShell).
  - Existe 1 test trivial en core que pasa.
  - Agregar `Math.random()` a un archivo de `packages/core/src` hace fallar `npm run lint` (verificarlo a mano y revertir; anotarlo en el reporte).
- **Verificación:** `npm run check`

---

## Fase 1 — Motor de combate (`packages/core`, sin red ni gráficos)

### [x] T1.1 Tipos y datos
- **Archivos:** `src/types.ts`, `src/data/classes.ts`, `src/data/boss.ts`.
- **Hacer:** tipos `Entity`, `Ability` (con tipo de objetivo `self | ally | enemy | none`), `Aura`, `EncounterConfig`, `EncounterState`, `Input`, `CombatEvent` (los eventos de daño y curación llevan `sourceId` y `abilityId`). Cargar como datos las 3 clases, el jefe (vida por número de jugadores, tabla de temporizadores por fase) y el xolo con los números exactos de SPEC §3, §5 y §6. Tiempos en ticks; armadura y modificadores en puntos base.
- **Criterios:** un test verifica valores clave contra el SPEC: vida de cada clase, costo de Gran remedio, CD de Escudo (18 s = 360 ticks), regeneración de maná, vida del jefe para 3/4/5 jugadores, vida del xolo para 3 y 5, y la tabla de temporizadores de fase 3.
- **Verificación:** `npm run check`

### [x] T1.2 RNG con semilla, reloj y movimiento
- **Archivos:** `src/rng.ts`, `src/encounter.ts`.
- **Hacer:** RNG determinista (por ejemplo, mulberry32). `createEncounter(config, seed)` con las posiciones de aparición de SPEC §6. `step(state, inputs, dtMs)` avanza exactamente un tick y no muta el estado recibido. Por ahora solo procesa `move` (7 m/s, recortado al muro de 20 m) y la orientación.
- **Criterios:**
  - Misma semilla y mismas entradas dan un estado idéntico (test con 200 ticks). Las mismas entradas en otro orden dentro del tick dan el mismo resultado.
  - Un jugador no atraviesa el muro.
  - `step` con `dtMs ≠ 50` lanza error.
  - `step` no muta el estado de entrada.
  - Las posiciones iniciales coinciden con SPEC §6.
- **Verificación:** `npm run check`

### [x] T1.3 Habilidades: validación, GCD, cooldowns, casteos y recursos
- **Archivos:** `src/abilities.ts` y sus tests.
- **Hacer:** la validación en el orden de SPEC §3 (7 pasos, con motivos de rechazo), GCD de 1.0 s, cooldowns, casteos (no empezar en movimiento, cancelar al moverse, cobro y CD al resolver), maná con su regeneración y habilidades off-GCD. Al resolverse, una habilidad **solo emite** el evento `abilityResolved`; los efectos llegan en T1.4.
- **Criterios (un test por punto):**
  - Se rechaza por GCD, por cooldown, por falta de maná, por alcance y por moverse al empezar un casteo.
  - Moverse cancela el casteo sin gastar maná y sin activar el cooldown.
  - El maná se cobra al resolver, no al empezar.
  - Las habilidades off-GCD se pueden usar durante el GCD y durante un casteo.
  - El alcance se mide restando el radio de cuerpo del objetivo.
- **Verificación:** `npm run check`

### [x] T1.4 Daño, curación, mitigación, muerte y Vuelo
- **Archivos:** `src/combat.ts`, `src/abilities.ts` (solo para Vuelo) y sus tests.
- **Hacer:** las fórmulas de SPEC §3 como funciones puras (crítico con RNG, armadura, lista de modificadores, redondeo hacia abajo, mínimo 1), tope de curación y curación efectiva, muerte. Conectar `abilityResolved` a los efectos de daño y curación directa de las clases (no Copal ni Escudo, que llegan en T1.6). Implementar el desplazamiento de Vuelo según SPEC §5.3 "Detalle de Vuelo".
- **Criterios:**
  - Golpe del Descarnado (400) al Jaguar sin modificadores hace 280; con un modificador de 0.5 pasado a la función hace 140.
  - Con `critChance: 1` la Flecha hace 210.
  - La sobrecuración no pasa de la vida máxima y la curación efectiva la excluye.
  - Una unidad muerta no actúa ni puede ser objetivo.
  - Vuelo quieto desplaza 8 m hacia la orientación; con `move` en el mismo tick desplaza 8 m en esa dirección, además del movimiento del tick.
  - Vuelo cerca del muro deja el centro del jugador en 20 m exactos.
  - Vuelo durante un casteo de Flecha emite `castCancelled`, la Flecha no hace daño y Vuelo activa su CD de 12 s (240 ticks).
- **Verificación:** `npm run check`

### [x] T1.5 Amenaza
- **Archivos:** `src/threat.ts` y sus tests.
- **Hacer:** todo SPEC §4: tablas por enemigo, ×3 del Jaguar, amenaza plana, amenaza por curación efectiva, umbrales de 110 % y 130 %, empate por id y Provocar.
- **Criterios:**
  - El jefe no cambia de objetivo con 105 % de amenaza y sí con 111 % (cuerpo a cuerpo); a distancia no cambia con 125 % y sí con 131 %.
  - Provocar fuerza el objetivo durante 3 s y deja la amenaza del tanque en `max(propia, máxima × 1.1)`.
  - La amenaza por curación se divide entre los enemigos vivos y no cuenta la sobrecuración.
  - La amenaza plana no se multiplica por ×3.
- **Verificación:** `npm run check`

### [x] T1.6 Auras
- **Archivos:** `src/auras.ts` y sus tests.
- **Hacer:** buffs y debuffs con duración, efectos periódicos (Copal) y modificadores de daño (Escudo), integrados con `combat.ts`.
- **Criterios:**
  - Copal cura 200 en total en 10 s, en 10 ticks de 20.
  - Recargar Copal reinicia la duración y el ritmo sin acumular.
  - El Escudo expira a los 6 s exactos.
  - Golpe del Descarnado al Jaguar con Escudo real hace 140.
- **Verificación:** `npm run check`

### [x] T1.7 IA de enemigo y casteos del jefe
- **Archivos:** `src/enemy.ts`, `src/boss.ts` y sus tests.
- **Hacer:** IA genérica de enemigo reutilizable por los xolos (auto-ataque, persecución a 5 m/s, objetivo por amenaza). Pull del jefe (SPEC §6). Casteos del jefe con las reglas de SPEC §3 "Casteo (enemigos)", incluida la cola. Golpe del Descarnado completo.
- **Criterios:**
  - El jefe está inactivo hasta el pull y el reloj del encuentro empieza en el pull.
  - El jefe persigue a su objetivo y le auto-ataca a ≤ 4 m.
  - El Golpe pega aunque el objetivo se aleje durante el casteo.
  - Una habilidad que toca durante otro casteo se encola y empieza al terminar ese casteo.
- **Verificación:** `npm run check`

### [x] T1.8 Fases y enfurecer
- **Archivos:** `src/phases.ts` y sus tests.
- **Hacer:** cambio de fase por % de vida con enteros, reinicio de temporizadores con la tabla de SPEC §6 y enfurecer a los 480 s del pull.
- **Criterios:**
  - Con el jefe al 66 % sigue en fase 1; al 65 % entra a fase 2. Al 30 % entra a fase 3.
  - El primer Golpe del Descarnado queda disponible a los 10 s de cada fase. En fases 1 y 2 empieza ahí; en fase 3 se encola tras el primer Lamento (empieza a los 8 s y dura 3 s) y empieza a los 11 s.
  - Un casteo en curso al cambiar de fase termina normalmente.
  - Enfurecer multiplica ×5 el daño del jefe y no el de los xolos.
- **Verificación:** `npm run check`

### [x] T1.9 Viento de obsidiana e interrupción
- **Archivos:** `src/mechanics/wind.ts`, `src/mechanics/interrupt.ts` y sus tests; ajustes en `boss.ts` y `abilities.ts`.
- **Hacer:** Viento (círculos de 4 m de radio fijos, aviso de 2 s, daño acumulable), daño del Lamento, y Lamento interrumpible con Grito de guerra (incluido el rechazo `not_casting`). Aplicar SPEC §10 (Viento, Lamento e interrupción). Las habilidades del jefe sin casteo dejan de emitir `castStarted`. Los casteos de jugador pasan a `interruptible: false`.
- **Criterios:**
  - Un jugador que sale del círculo antes de 2 s no recibe daño; uno dentro de 2 círculos recibe 400.
  - Con 2 jugadores vivos se marcan 2 círculos.
  - El Lamento sin interrumpir hace 250 a cada jugador vivo (175 al Jaguar); interrumpirlo cancela ese daño.
  - Grito sobre un objetivo que no castea se rechaza y no gasta el CD.
- **Verificación:** `npm run check`

### [x] T1.10 Xolos
- **Archivos:** `src/mechanics/xolos.ts` y sus tests.
- **Hacer:** Llamado de los xolos (2 en ángulos opuestos del muro, cada 40 s solo en fase 2), vida según jugadores, IA de T1.7 y su tabla de amenaza propia con 1 de amenaza inicial al Tícitl. Aplicar SPEC §10 (Xolos).
- **Criterios:**
  - Al entrar a fase 2 aparecen 2 xolos en el muro, opuestos entre sí.
  - Los xolos van primero por el Tícitl; si está muerto, por el jugador vivo más cercano.
  - Rugido o Provocar les cambian el objetivo al Jaguar.
  - En fase 3 no aparecen xolos nuevos y los vivos siguen.
- **Verificación:** `npm run check`

### [x] T1.11 Arena de fase 3 y fin del encuentro
- **Archivos:** `src/mechanics/arena.ts` y sus tests.
- **Hacer:** reducción lineal del radio seguro (20 → 12 m en 10 s), daño de 5 por tick fuera del radio seguro, y las condiciones de victoria y derrota. Aplicar SPEC §10 (Radio seguro y fin del encuentro), incluido el golpe letal en el evento `death` (`combat.ts`).
- **Criterios:**
  - A los 5 s de entrar a fase 3 el radio seguro es 16 m.
  - Fuera del radio seguro se reciben 100/s, sin armadura ni Escudo.
  - El estado pasa a `victory` o `defeat` según corresponda; si ambas ocurren en el mismo tick, `victory`.
  - Después del fin, `step` no produce eventos ni cambia nada salvo `tick`.
  - El evento `death` trae el `abilityId` del golpe letal.
- **Verificación:** `npm run check`

### [x] T1.12 Simulador: bots y runner
- **Archivos:** `packages/core/sim/bots.ts`, `packages/core/sim/runner.ts` y sus tests.
- **Hacer:** bots simples por clase que generan `inputs`:
  - **Tanque:** provoca, usa Escudo ante el Golpe y Rugido ante los xolos.
  - **Sanador:** Copal y Remedio al de menor vida.
  - **Daño:** castea Flecha e interrumpe el Lamento.
  - **Todos:** salen de los círculos de Viento y se quedan dentro del radio seguro.

  El runner corre un combate completo con semilla y número de jugadores dados.
- **Criterios:**
  - El runner termina siempre en `victory` o `defeat` (con un límite de ticks de seguridad).
  - Misma semilla da el mismo resultado.
  - Un test verifica que el bot esquiva un círculo de Viento.
- **Verificación:** `npm run check`

### [x] T1.13 Simulador: reporte y CLI
- **Archivos:** `packages/core/sim/run.ts`, `packages/core/sim/report.ts`, script `npm run sim`.
- **Hacer:** CLI con `--players` y `--runs`. Imprime por número de jugadores:
  - % de victorias
  - duración media
  - muertes por habilidad
  - DPS/HPS por clase
  - número de cambios de objetivo del jefe
- **Criterios:** `npm run sim -- --players=3 --runs=50` termina en menos de 30 s y muestra todas las métricas.
- **Verificación:** `npm run check` y `npm run sim -- --players=3 --runs=50`

> **Checkpoint A:** Claude revisa el reporte del simulador contra la duración objetivo (4–7 min) y propone ajustes de números en el SPEC antes de pasar a la red.

---

## Fase 2 — Servidor (`apps/server`)

### [x] T2.1 Sala de Colyseus y lobby
- **Hacer:** sala `raid` con código de 4 letras, de 3 a 5 jugadores, mensajes `ready {classId}` con validación de la composición (SPEC §5) e inicio cuando todos están listos. Estado del lobby sincronizado. Variable de entorno `MICTLAN_DEV_MIN_PLAYERS` (por defecto 3) para pruebas con menos jugadores; también relaja la composición. En core, agregar `devMode?` a `EncounterConfig` según SPEC §7 (con 1–2 jugadores, el jefe y los xolos usan los valores de 3).
- **Criterios:**
  - Un test de integración (cliente de Colyseus en Node) une 3 clientes, los marca listos y la sala pasa a `combat`.
  - Un segundo Jaguar recibe rechazo al marcarse listo.
  - Con `MICTLAN_DEV_MIN_PLAYERS=1` un solo cliente puede iniciar.
  - En core: sin `devMode`, `createEncounter` con 2 jugadores lanza error; con `devMode: true`, 1 jugador funciona y el jefe tiene 24 000 de vida.
  - No hay APIs inventadas: todo lo usado existe en los tipos de la versión instalada.
- **Verificación:** `npm run check`

### [x] T2.2 Bucle de combate y entradas
- **Hacer:** correr `step()` de core a 20 Hz (acumulador de tiempo, un `step` por tick), y traducir y validar los mensajes `move`, `target` y `cast` a `inputs`.
- **Criterios:**
  - Un test de integración: un cliente castea Flecha y la vida del jefe baja 140 (o 210 con crítico).
  - Un mensaje inválido (payload mal formado, entidad inexistente, vector sin normalizar) no tumba el servidor y se ignora o normaliza.
- **Verificación:** `npm run check`

### [x] T2.3 Estado sincronizado y eventos
- **Hacer:** esquema de Colyseus con todo el estado de SPEC §7 (entidades, auras, zonas, fase, radio seguro, tiempo y estado de la sala) y difusión de los eventos de combate a los clientes.
- **Criterios:**
  - Un test de integración ve cambiar la vida, la posición, el casteo con su progreso y las auras en el cliente.
  - Los eventos de daño llegan al cliente con `sourceId` y `abilityId`.
- **Verificación:** `npm run check`

### [x] T2.4 Fin de encuentro y reinicio
- **Hacer:** victoria o derrota, regreso al lobby después de 5 s y manejo de desconexiones (el jugador desconectado muere en combate o sale del lobby).
- **Criterios:** tests de integración para la victoria, la derrota y una desconexión a media pelea.
- **Verificación:** `npm run check`

---

## Fase 3 — Cliente (`apps/client`)

### [x] T3.1 Escena base
- **Hacer:**
  - Vite + Phaser y conexión a la sala.
  - Dibujo de la arena (muro y radio seguro) y de las entidades con los placeholders de SPEC §8.
  - WASD y posiciones interpoladas (unos 100 ms).
  - Modo de desarrollo `?dev=1`: se une, elige clase y marca listo solo. Usarlo con `MICTLAN_DEV_MIN_PLAYERS`.
- **Criterios (verificación manual de Venegas):** 2 pestañas del navegador se ven moverse una a la otra de forma fluida.
- **Verificación:** `npm run dev` y prueba manual

### [x] T3.2 Selección de objetivo y barra de acción
- **Hacer:** Tab y clic para seleccionar enemigos, F1–F5 y Shift+1–5 para aliados (con `preventDefault`), barra de acción 1–4 con cooldowns, GCD y estados "sin recurso" y "fuera de alcance".
- **Criterios (manual):** se puede jugar cualquier clase solo con el teclado, F5 no recarga la página y se ve cuándo cada habilidad está disponible.
- **Verificación:** `npm run dev` y prueba manual

### [x] T3.3 Marcos de unidad y barras de casteo
- **Hacer:** marco propio, marco del objetivo, marcos de grupo clicables, barras de casteo propia y del jefe (borde distinto si es interrumpible).
- **Criterios (manual):** el sanador puede curar a cualquiera haciendo clic en los marcos de grupo, y se distingue el Lamento (interrumpible) del Golpe.
- **Verificación:** `npm run dev` y prueba manual

### [x] T3.7 Movimiento con clic derecho
- **Hacer:** reemplazar WASD por clic derecho (destino) y S (parar), como en LoL. El servidor recibe `moveTo`/`stop` y mueve hacia el destino cada tick; pedir un casteo con tiempo de casteo detiene el movimiento. Marca del destino en el suelo.
- **Criterios:** clic derecho lleva al jugador al punto; S lo detiene; castear Flecha mientras camina la lanza sin rechazo por movimiento.
- **Verificación:** `npm run check` y prueba manual

### [x] T3.4 Lectura del combate
- **Hacer:** dibujo de las zonas de peligro, texto flotante, log de combate (con el nombre de la habilidad en español) y temporizador del encuentro.
- **Criterios (manual):** un jugador nuevo entiende qué lo mató leyendo el log.
- **Verificación:** `npm run dev` y prueba manual

### [x] T3.5 Lobby jugable
- **Hacer:** pantalla para crear o unirse con código, elegir clase (mostrando qué roles faltan), botón de listo y pantalla de victoria o derrota.
- **Criterios (manual):** 3 pestañas completan el flujo lobby → combate → resultado → lobby.
- **Verificación:** `npm run dev` y prueba manual

---

### [-] T3.6 Pulido visual procedural — CANCELADA
- **Motivo:** Venegas decidió migrar a 3D (Three.js) después del Checkpoint B; pulir Phaser sería trabajo tirado. Su alcance pasa a la Fase 5.

---

## Fase 4 — Playtest

### [x] T4.1 Jugar con amigos
- **Hacer:** script `npm run start` que levanta el servidor sirviendo el cliente compilado, más una guía en el README para exponerlo con un túnel (por ejemplo, Cloudflare Tunnel) y que tus amigos entren.
- **Además:** `"dev": "vite --host"` en `apps/client/package.json` para jugar en red local sin túnel (en la prueba de T3.5 hubo que pasar `-- --host` a mano), y documentar en el README el permiso del firewall de Windows (perfil de red Privado).
- **Criterios:** 3 personas en redes distintas completan un intento.

### [x] T4.2 Balance: vida del jefe
- **Hacer:** vida del jefe a 15 000 / 25 000 / 35 000 (3/4/5 jugadores, SPEC §6 v0.8). Actualizar los tests que dependían de los valores anteriores y correr el simulador.
- **Criterios:** `npm run sim -- --players=3 --runs=50` da 100 % de victorias con duración media de 3:00 a 4:00 (los bots juegan perfecto; los humanos tardarán más).

### [ ] T4.3 Habilidades y roles legibles
- **Hacer:** (1) en el lobby, al elegir clase, panel con el rol y sus 4 habilidades (tecla, qué hace en una línea, tipo, costo, casteo, recarga, alcance); (2) botón "Cómo jugar" por clase con la guía del rol: tu trabajo, rotación básica, qué evitar y cómo coordinarte; (3) en combate, tooltip al pasar el mouse sobre la barra de acción y etiqueta de tipo en cada botón (daño, cura, defensa, control). Todo en HTML (sobrevive a la Fase 5). Datos de core y SPEC §5; textos en el cliente.
- **Criterios (manual de Venegas):** un jugador nuevo, tras leer la guía de su rol, sabe qué tecla usar y cuándo sin preguntar.
- **Opcional después (T4.4):** práctica interactiva de un jugador con pasos guiados, solo si la guía no basta.

> **Checkpoint B:** después de 5 intentos reales, anotar qué fue divertido, qué fue injusto y qué no se entendió. Claude convierte eso en cambios al SPEC y en tareas nuevas.

---

## Fase 5 — 3D con Three.js

Objetivo: el ambiente de SPEC §9 con cámara isométrica. Core, servidor y red no cambian; del cliente se conservan los módulos puros (snapshot, frames, combat-log, targeting, floating-texts, lobby...) y se reemplaza lo que vive en `scene/` (Phaser). Antes de T5.1: Claude instala `three` (Codex no tiene red) y propone el reparto final de tareas según lo que deje el Checkpoint B.

### [ ] T5.1 Escena 3D y entrada
- **Hacer:** reemplazar Phaser por Three.js: arena (piso, muro), unidades como formas simples con color por clase, cámara isométrica fija, interpolación existente, y entrada por raycast contra el suelo (clic izquierdo selecciona, clic derecho camina, Tab, F1–F5, QWER, S).
- **Criterios (manual de Venegas):** se juega un intento completo igual que con Phaser.

### [ ] T5.2 HUD en HTML
- **Hacer:** marcos propio/objetivo/grupo, barras de casteo, barra de acción con recarga, log, temporizador, avisos y números flotantes (proyectados del mundo a pantalla) en HTML sobre el canvas, reusando los módulos puros de T3.2–T3.4.
- **Criterios (manual de Venegas):** misma información que el HUD de Phaser; los números no tapan el HUD.

### [ ] T5.3 Ambiente y efectos
- **Hacer:** luz, sombras, bloom, viñeta, áreas de daño que brillan con borde animado, aura del jefe al castear, barras sobre las unidades estilo LoL, partículas y destello al recibir daño (SPEC §9).
- **Criterios (manual de Venegas):** se parece en ambiente a las referencias, el peligro se lee mejor que en Phaser y sigue a 60 fps con 5 jugadores, 4 xolos y 3 zonas.

### [ ] T5.4 Modelos y animaciones
- **Hacer:** modelos glTF del jefe, las tres clases y los xolos, más escenario, con animaciones (caminar, atacar, castear, morir). Antes de delegar: elegir la fuente (packs CC0 como Quaternius o KayKit, generados o encargados) y registrar la licencia (SPEC §9).
- **Criterios (manual de Venegas):** cada clase y el jefe se reconocen sin leer nombres; sigue a 60 fps.
