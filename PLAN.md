# MICTLÁN — Plan de implementación

**Reglas del plan**
- Codex implementa **una tarea a la vez**, en orden. Claude revisa y marca el estado.
- Estados: `[ ]` pendiente · `[~]` en curso · `[x]` hecha · `[!]` bloqueada (anotar motivo).
- Una tarea está terminada solo si cumple **todos** sus criterios y `npm run check` pasa.
- La fuente de verdad de reglas y números es `SPEC.md`. Si hay conflicto, gana el SPEC.

---

## Fase 0 — Base del proyecto

### [ ] T0.1 Monorepo
- **Archivos:** `package.json` raíz, `tsconfig.base.json`, `packages/core/*`, `apps/server/`, `apps/client/` (vacías salvo `package.json`), `.gitignore`, `.editorconfig`.
- **Hacer:** npm workspaces, TypeScript `strict`, Vitest en `packages/core`, y los scripts raíz `test`, `typecheck` y `check` (= typecheck + test).
- **Criterios:**
  - `npm install` y `npm run check` funcionan en Windows (PowerShell).
  - Existe 1 test trivial en core que pasa.
- **Verificación:** `npm run check`

---

## Fase 1 — Motor de combate (`packages/core`, sin red ni gráficos)

### [ ] T1.1 Tipos y datos
- **Archivos:** `src/types.ts`, `src/data/classes.ts`, `src/data/boss.ts`.
- **Hacer:** tipos `Entity`, `Ability`, `Aura`, `EncounterState`, `Input`, `CombatEvent`. Cargar como datos las 3 clases y el jefe con los números exactos de SPEC §5 y §6.
- **Criterios:** un test verifica algunos valores clave contra el SPEC (vida de cada clase, costo de Gran remedio, CD de Escudo, fórmula de vida del jefe).
- **Verificación:** `npm run check`

### [ ] T1.2 RNG con semilla y reloj
- **Archivos:** `src/rng.ts`, `src/encounter.ts`.
- **Hacer:** RNG determinista (por ejemplo, mulberry32), `createEncounter(config, seed)` y `step(state, inputs, dtMs)` con tick fijo de 50 ms. Por ahora solo avanza el tiempo y el movimiento (7 m/s, sin salir de la arena).
- **Criterios:**
  - Misma semilla y mismas entradas dan un estado idéntico (test con 200 ticks).
  - Un jugador no sale del radio de la arena.
- **Verificación:** `npm run check`

### [ ] T1.3 Habilidades: GCD, cooldowns, casteos y recursos
- **Archivos:** `src/abilities.ts` y sus tests.
- **Hacer:** la validación en el orden de SPEC §3, GCD de 1.0 s, cooldowns, casteos que se cancelan al moverse, maná con su regeneración y habilidades off-GCD.
- **Criterios (un test por punto):**
  - Se rechaza por GCD, por cooldown, por falta de maná y por alcance.
  - Moverse cancela el casteo sin gastar maná.
  - Las habilidades off-GCD se pueden usar durante el GCD.
- **Verificación:** `npm run check`

### [ ] T1.4 Daño, curación, mitigación y muerte
- **Archivos:** `src/combat.ts` y sus tests.
- **Hacer:** las fórmulas de SPEC §3 (crítico con RNG, armadura, modificadores de auras, redondeo hacia abajo, mínimo 1), tope de curación y muerte.
- **Criterios:**
  - Golpe del Descarnado al Jaguar sin escudo hace 280 y con escudo 140 (sin crítico).
  - La sobrecuración no pasa de la vida máxima.
  - Una unidad muerta no actúa ni puede ser objetivo.
- **Verificación:** `npm run check`

### [ ] T1.5 Amenaza
- **Archivos:** `src/threat.ts` y sus tests.
- **Hacer:** todo SPEC §4: tablas por enemigo, ×3 del Jaguar, amenaza por curación, umbrales de 110 % y 130 % y Provocar.
- **Criterios:**
  - El jefe no cambia de objetivo con 105 % de amenaza y sí con 111 % (cuerpo a cuerpo).
  - Provocar fuerza el objetivo durante 3 s.
  - La amenaza por curación se divide entre los enemigos vivos.
- **Verificación:** `npm run check`

### [ ] T1.6 Auras
- **Archivos:** `src/auras.ts` y sus tests.
- **Hacer:** buffs y debuffs con duración, efectos periódicos (Copal) y modificadores de daño (Escudo).
- **Criterios:**
  - Copal cura 200 en total en 10 s.
  - Recargar Copal reinicia la duración sin acumular.
  - El Escudo expira a los 6 s exactos.
- **Verificación:** `npm run check`

### [ ] T1.7 IA del jefe y fases
- **Archivos:** `src/boss.ts` y sus tests.
- **Hacer:** auto-ataque, persecución del objetivo, temporizadores por fase (primeros usos incluidos), cambio de fase por % de vida y enfurecer a los 480 s.
- **Criterios:**
  - Con el jefe al 64 % entra a fase 2. Con el jefe al 29 % entra a fase 3.
  - El primer Golpe del Descarnado empieza a los 10 s de la fase 1.
  - Enfurecer multiplica su daño ×5.
- **Verificación:** `npm run check`

### [ ] T1.8 Mecánicas: zonas, interrupción, xolos y arena
- **Archivos:** `src/mechanics.ts` y sus tests.
- **Hacer:** Viento de obsidiana (aviso de 2 s y luego daño), Lamento interrumpible con Grito de guerra, invocación de xolos con su tabla de amenaza propia, reducción de la arena en fase 3 con daño por segundo afuera, y las condiciones de victoria y derrota.
- **Criterios:**
  - Un jugador que sale del círculo antes de 2 s no recibe daño.
  - Interrumpir el Lamento cancela sus 250 de daño.
  - Los xolos van primero por el sanador.
  - Fuera de la arena en fase 3 se reciben 100/s.
  - El estado pasa a `victoria` o `derrota` según corresponda.
- **Verificación:** `npm run check`

### [ ] T1.9 Simulador sin interfaz (para balance)
- **Archivos:** `packages/core/sim/run.ts`, script `npm run sim`.
- **Hacer:** bots simples por clase (el tanque provoca y usa Escudo ante el Golpe, el sanador cura al de menor vida, el daño castea Flecha e interrumpe el Lamento). Corre N combates con distintas semillas y composición configurable.
- **Criterios:** imprime, por composición, el % de victorias, la duración media, las muertes por habilidad y el DPS/HPS por clase. `npm run sim -- --players=3 --runs=50` termina en menos de 30 s.
- **Verificación:** `npm run check` y `npm run sim -- --players=3 --runs=50`

> **Checkpoint A:** Claude revisa el reporte del simulador contra la duración objetivo (4–7 min) y propone ajustes de números en el SPEC antes de pasar a la red.

---

## Fase 2 — Servidor (`apps/server`)

### [ ] T2.1 Sala de Colyseus y lobby
- **Hacer:** sala `raid` con código de 4 letras, de 3 a 5 jugadores, mensajes `ready {classId}` e inicio cuando todos están listos. Estado del lobby sincronizado.
- **Criterios:**
  - Un test de integración (cliente de Colyseus en Node) une 3 clientes, los marca listos y la sala pasa a `combate`.
  - No hay APIs inventadas: todo lo usado existe en los tipos de la versión instalada.
- **Verificación:** `npm run check`

### [ ] T2.2 Bucle de combate
- **Hacer:** correr `step()` de core a 20 Hz, traducir los mensajes `move`, `target` y `cast` a `inputs`, sincronizar el estado de SPEC §7 y emitir eventos de combate.
- **Criterios:**
  - Un test de integración: un cliente castea Flecha y la vida del jefe baja 140 (o 210 con crítico).
  - Un mensaje inválido no tumba el servidor.
- **Verificación:** `npm run check`

### [ ] T2.3 Fin de encuentro y reinicio
- **Hacer:** victoria o derrota, regreso al lobby después de 5 s y manejo de desconexiones (el jugador desconectado muere en combate o sale del lobby).
- **Criterios:** tests de integración para la victoria, la derrota y una desconexión a media pelea.
- **Verificación:** `npm run check`

---

## Fase 3 — Cliente (`apps/client`)

### [ ] T3.1 Escena base
- **Hacer:** Vite + Phaser, conexión a la sala, dibujo de la arena y las entidades con los placeholders de SPEC §8, WASD y posiciones interpoladas (unos 100 ms).
- **Criterios (verificación manual de Venegas):** 2 pestañas del navegador se ven moverse una a la otra de forma fluida.
- **Verificación:** `npm run dev` y prueba manual

### [ ] T3.2 Interfaz de combate
- **Hacer:** Tab y clic para seleccionar objetivo, F1–F5 para aliados, barra de acción 1–4 con cooldowns, barras de casteo y marcos de unidad y de grupo.
- **Criterios (manual):** se puede jugar cualquier clase solo con el teclado y se ve cuándo cada habilidad está disponible.
- **Verificación:** `npm run dev` y prueba manual

### [ ] T3.3 Lectura del combate
- **Hacer:** dibujo de las zonas de peligro, borde del casteo interrumpible, texto flotante, log de combate y temporizador del encuentro.
- **Criterios (manual):** un jugador nuevo entiende qué lo mató leyendo el log.
- **Verificación:** `npm run dev` y prueba manual

### [ ] T3.4 Lobby jugable
- **Hacer:** pantalla para crear o unirse con código, elegir clase, botón de listo y pantalla de victoria o derrota.
- **Criterios (manual):** 3 pestañas completan el flujo lobby → combate → resultado → lobby.
- **Verificación:** `npm run dev` y prueba manual

---

## Fase 4 — Playtest

### [ ] T4.1 Jugar con amigos
- **Hacer:** script `npm run start` que levanta el servidor y el cliente compilado, más una guía en el README para exponerlo con un túnel (por ejemplo, Cloudflare Tunnel) y que tus amigos entren.
- **Criterios:** 3 personas en redes distintas completan un intento.

> **Checkpoint B:** después de 5 intentos reales, anotar qué fue divertido, qué fue injusto y qué no se entendió. Claude convierte eso en cambios al SPEC y en tareas nuevas.
