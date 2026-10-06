# NOTAS — Bitácora del flujo Claude + Codex

## Estado al 2026-10-05

| Tarea | Commit | Rebotes | Notas |
|---|---|---|---|
| T0.1 Monorepo | `5cceb36` | 1 | Test frágil (apps vacías), tipos de Node en core/src, tests en dos carpetas, `check` con pre/post hooks |
| T1.1 Tipos y datos | `4831429` | 0 | — |
| T1.2 RNG, reloj y movimiento | `1ecd209` | 0 | — |
| T1.3 Habilidades | `bcbe8ad` | 0 | Primer intento matado por falta de memoria del sistema; relanzado sin cambios |
| T1.4 Daño, curación, muerte y Vuelo | `072e443` | 0 | Se detuvo una vez: su `npm ci` borró `node_modules` y la sandbox no tiene red. Venegas reinstaló y se reanudó |

| T1.5 Amenaza | (pendiente) | 0 | — |

Siguiente: **T1.6** (no lanzada).

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
- Provocar toma como "máxima actual" toda la tabla, **incluidas las entradas de jugadores muertos** (las entradas no se borran al morir; esos jugadores solo no pueden ser objetivo). Pendiente de confirmar.
- La amenaza se acumula antes del pull; T1.7 decide qué pasa con ella.

## Decisiones de Venegas (2026-10-06)

- **Vuelo:** entra en T1.4. Detalle en SPEC §5.3 (v0.3).
- **Modo dev con 1–2 jugadores:** `devMode` en `EncounterConfig`, con valores de 3 jugadores. Se implementa en T2.1. SPEC §6 y §7 (v0.3).
- **Orden:** se sigue el PLAN tal cual (sin corte vertical).

## Decisiones pendientes (de Venegas)

1. **Provocar con muertos en la tabla:** ¿la "máxima actual" de Provocar debe ignorar a los jugadores muertos? Propuesta: sí (filtrar vivos); es un cambio de 1 línea en `threat.ts`.
2. **`.gitattributes`** con `* text=auto eol=lf`, para quitar los avisos LF→CRLF (`core.autocrlf=true` contra `.editorconfig` en LF).

## Recordatorios para los próximos prompts

- **Todas:** `step` reutiliza por referencia las entidades sin cambios; está prohibido mutar el estado.
- **T1.5:** los números de amenaza de SPEC §4 (curación ×0.5, umbrales de 110 % y 130 %) deben ir en `data/`; todavía no están.
- **T1.9:** los casteos de jugador se crean con `interruptible: true` (`abilities.ts`); cambiar a `false`.
- **T2.2:** un `move` con `NaN` o `Infinity` deja la posición en `NaN`; el servidor debe validarlo.
