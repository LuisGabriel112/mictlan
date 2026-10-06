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
- Provocar toma como "máxima actual" toda la tabla, **incluidas las entradas de jugadores muertos**. Se corrige en T1.6 (ver abajo).
- La amenaza se acumula antes del pull; T1.7 decide qué pasa con ella.

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

## Prompt listo para T1.6

Lanzar con `/codex:rescue --fresh --model gpt-6-astra --effort xhigh` y este texto:

```
Tarea T1.6 — Auras.

Lee AGENTS.md, SPEC.md (v0.3: §3 y las filas de Copal y Escudo de obsidiana en §5) y la tarea T1.6 de PLAN.md. Implementa SOLO T1.6, más la corrección de Provocar de abajo.

IMPORTANTE: las dependencias ya están instaladas. NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit.

Alcance:
- packages/core/src/auras.ts (nuevo) y sus tests. Puedes tocar combat-effects.ts y encounter.ts solo para conectar las auras.
- Usa los datos que ya existen en data/classes.ts (efecto applyAura de Copal y de Escudo, tipos AuraDefinition y Aura). Nada de números sueltos.
- Copal: cura 20 cada 1.0 s durante 10 s (10 ticks de curación, el primero 1 s después de aplicarlo). Recargarlo reinicia duración y ritmo, sin acumular. Cada tick de Copal puede criticar (fuente jugador) y genera amenaza por curación efectiva como cualquier curación (threat.ts ya lo hace con eventos healing).
- Escudo de obsidiana: −50 % de daño recibido durante 6 s exactos (120 ticks). Pasa su modificador a calculateDamage.
- Decide y documenta en qué punto del tick avanzan las auras (propuesta: junto a los demás timers, al inicio del tick).
- Las auras desaparecen al morir la unidad.
- Los eventos de curación de Copal llevan sourceId (el sanador) y abilityId 'copal'.

Corrección de T1.5 (incluida en esta tarea):
- threat.ts, tauntEnemy: la "máxima actual" debe considerar solo jugadores vivos. Actualiza el test "taunt maximum includes existing dead-player entries…" para que pruebe lo contrario.

Criterios (un test por punto):
1. Copal cura 200 en total en 10 s, en 10 ticks de 20.
2. Recargar Copal reinicia la duración y el ritmo sin acumular.
3. El Escudo expira a los 6 s exactos.
4. Golpe del Descarnado (400) al Jaguar con Escudo real (aplicado con la habilidad) hace 140.
5. Provocar ignora la amenaza de jugadores muertos.

Reglas existentes: step no muta el estado y reutiliza por referencia las entidades sin cambios. Tests con critChance: 0 salvo que pruebes el crítico.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

## Recordatorios para los próximos prompts

- **Todas:** `step` reutiliza por referencia las entidades sin cambios; está prohibido mutar el estado.
- **T1.5:** los números de amenaza de SPEC §4 (curación ×0.5, umbrales de 110 % y 130 %) deben ir en `data/`; todavía no están.
- **T1.9:** los casteos de jugador se crean con `interruptible: true` (`abilities.ts`); cambiar a `false`.
- **T2.2:** un `move` con `NaN` o `Infinity` deja la posición en `NaN`; el servidor debe validarlo.
