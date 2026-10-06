# NOTAS — Bitácora del flujo Claude + Codex

## Estado al 2026-10-05

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

Siguiente: **T1.8**. Se lanzó el 2026-10-06 en la PC del trabajo con poca cuota de Codex. Si no aparece su commit en `git log`, **relanzarla desde cero** con el prompt de abajo. El hilo de Codex vive solo en esa PC y no se puede reanudar desde otra; cualquier trabajo parcial sin commit allá se ignora.

## Prompt listo para T1.8

Lanzar con `/codex:rescue --fresh --model gpt-6-astra --effort xhigh` y este texto:

```
Tarea T1.8 — Fases y enfurecer.

Lee AGENTS.md, SPEC.md (v0.3: §6 completo, sobre todo "Temporizadores", "Cambio de fase" y "Enfurecer"), la tarea T1.8 de PLAN.md y la sección "T1.7" de NOTAS.md (orden del tick y convención de tiempo). Implementa SOLO T1.8.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit.

Alcance: packages/core/src/phases.ts (nuevo) y sus tests. Puedes tocar boss.ts, encounter.ts y combat-effects.ts solo para conectarlo. Usa los campos existentes de EncounterState (phase, phaseElapsedTicks, enraged, bossAbilityTimers, bossAbilityQueue) y los datos de BOSS_PHASES y BOSS.enrage. Nada de números sueltos.

1. Cambio de fase: se evalúa al final de cada tick con enteros (healthThresholdBps). La nueva fase aplica desde el tick siguiente. Si en un tick se cruzan ambos umbrales, pasa directo a fase 3. Nunca se regresa. Solo después del pull y con el jefe vivo.
2. Al entrar a una fase: bossAbilityTimers se reinicia con los "primero" de esa fase (las habilidades que no existen en ella desaparecen); se vacía bossAbilityQueue; phaseElapsedTicks reinicia con la convención del pull (el primer tick cuenta como 1); un casteo en curso termina normalmente y aplica su efecto; se emite un evento de cambio de fase (agrega el tipo si no existe).
3. Enfurecer: cuando elapsedTicks llega a BOSS.enrage.afterTicks, enraged = true y se emite un evento. El daño del jefe cuyo abilityId esté en affectedAbilityIds se multiplica por damageMultiplierBps como un modificador más de calculateDamage (un solo floor). No afecta a los xolos (filtra por fuente = jefe) ni a la arena.
4. NO hagas Viento, Lamento con efecto, interrupción, xolos ni arena.

Reglas existentes: step no muta el estado y reutiliza por referencia las entidades sin cambios. Tests con critChance: 0.

Criterios (un test por punto):
1. Con el jefe al 66 % sigue en fase 1; al 65 % entra a fase 2; al 30 % entra a fase 3. Prueba también el salto directo 1 → 3.
2. El primer Golpe queda disponible en phaseElapsedTicks = 200 en cada fase. En fases 1 y 2 empieza en 200; en fase 3 se encola tras el primer Lamento (empieza en 160, dura 60) y empieza en 220.
3. Un casteo en curso al cambiar de fase termina normalmente y aplica su daño.
4. Enfurecer multiplica ×5 el daño del jefe (auto-ataque 60 → 300; al Jaguar 210) y no el de los xolos.
5. Al entrar a fase 3 desaparece el temporizador de Viento y se vacía la cola.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

## Configuración de Codex

- `~/.codex/config.toml` traía `model = "gpt-5.2"`, que falla con cuenta de ChatGPT (HTTP 400).
- Se delega con `--model gpt-6-astra --effort xhigh`.
- PowerShell bloquea `npm.ps1`: usar `npm.cmd`.
- La sandbox de Codex no tiene red: prohibirle `npm ci` y `npm install` en cada prompt.

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

## Decisiones de Venegas (2026-10-06)

- **Vuelo:** entra en T1.4. Detalle en SPEC §5.3 (v0.3).
- **Modo dev con 1–2 jugadores:** `devMode` en `EncounterConfig`, con valores de 3 jugadores. Se implementa en T2.1. SPEC §6 y §7 (v0.3).
- **Orden:** se sigue el PLAN tal cual (sin corte vertical).

## Decisiones de Claude (delegadas por Venegas, 2026-10-06)

- **Provocar ignora a los jugadores muertos** al calcular la "máxima actual". Motivo: un muerto no genera amenaza (SPEC §3) y no debería inflar la del tanque. Se corrige dentro de T1.6.
- **Se mantiene el orden del PLAN** (sin corte vertical). Motivo: el esquema sincronizado de T2.3 incluye auras, zonas, fase y radio seguro; hacer el servidor antes del motor obligaría a rehacerlo. El simulador (T1.13) es el primer punto para ver un combate completo.
- **`.gitattributes`** con `* text=auto eol=lf`, agregado por Claude (configuración, no es tarea del plan).

## Decisiones pendientes (de Venegas)

Ninguna.

## Recordatorios para los próximos prompts

- **Todas:** `step` reutiliza por referencia las entidades sin cambios; está prohibido mutar el estado.
- **T1.5:** los números de amenaza de SPEC §4 (curación ×0.5, umbrales de 110 % y 130 %) deben ir en `data/`; todavía no están.
- **T1.9:** los casteos de jugador se crean con `interruptible: true` (`abilities.ts`); cambiar a `false`.
- **T2.2:** un `move` con `NaN` o `Infinity` deja la posición en `NaN`; el servidor debe validarlo.
