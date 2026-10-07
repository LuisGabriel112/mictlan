# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --fresh --model gpt-6-astra --effort xhigh` seguido del texto del bloque.
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

---

## T1.9 — Viento de obsidiana e interrupción

```
Tarea T1.9 — Viento de obsidiana e interrupción.

Lee AGENTS.md, SPEC.md (§3 "Validación", §5.3 Grito de guerra, §6 Viento y Lamento, y §10 "Aclaraciones": Viento, Lamento e interrupción, habilidades sin casteo), la tarea T1.9 de PLAN.md y NOTAS.md (secciones T1.7 y T1.8). Implementa SOLO T1.9.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit.

Alcance: packages/core/src/mechanics/wind.ts y packages/core/src/mechanics/interrupt.ts (nuevos) y sus tests. Puedes tocar boss.ts, abilities.ts, encounter.ts y combat-effects.ts solo para conectarlos. Usa los datos de BOSS_ABILITIES (obsidianWind, lamentOfTheDead), el tipo DangerZone y EncounterState.zones. Nada de números sueltos.

1. Viento: al resolverse, elige con el RNG del estado, sin repetir, hasta maxTargets jugadores vivos (ordenados por id antes de elegir). Crea una DangerZone fija en la posición de cada uno, con id determinista. Tras warningTicks, cada zona hace baseDamage a cada jugador vivo cuyo centro esté a ≤ radiusMeters del centro de la zona, y desaparece. Las zonas superpuestas suman daño. El daño pasa por la fórmula normal (armadura, Escudo y enfurecer). Una zona marcada explota aunque el jefe cambie de fase o muera. Decide y documenta en qué paso del tick bajan y explotan las zonas.
2. Lamento: al resolverse, baseDamage a cada jugador vivo, con la fórmula normal.
3. Grito de guerra: tras el paso 6 de la validación, si el objetivo no castea algo con interruptible = true, se rechaza con `not_casting` y no activa su cooldown. Si sí, cancela el casteo del objetivo con `castCancelled` motivo `interrupted` (sin efecto) y Grito activa su cooldown.
4. Los casteos de jugador se crean con interruptible: false (hoy abilities.ts usa true).
5. Las habilidades del jefe con castTicks 0 (Viento, Llamado de los xolos) dejan de emitir castStarted; solo emiten abilityResolved. Ajusta los tests de T1.7 que lo esperaban.

Reglas existentes: step no muta el estado y reutiliza por referencia las entidades sin cambios. Tests con critChance: 0.

Criterios (un test por punto):
1. Un jugador que sale del círculo antes de 2 s no recibe daño; uno dentro de 2 círculos recibe 400.
2. Con 2 jugadores vivos se marcan 2 círculos; con 5 vivos, 3.
3. El Lamento sin interrumpir hace 250 a cada jugador vivo (175 al Jaguar); interrumpirlo con Grito cancela ese daño y emite castCancelled con motivo interrupted.
4. Grito sobre un objetivo que no castea (o que castea el Golpe, no interrumpible) se rechaza con not_casting y no gasta el CD.
5. La misma semilla elige los mismos jugadores para el Viento.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T1.10 — Xolos

```
Tarea T1.10 — Xolos.

Lee AGENTS.md, SPEC.md (§4, §6 "Fase 2" y "Llamado de los xolos", y §10 "Xolos"), la tarea T1.10 de PLAN.md y NOTAS.md (secciones T1.5, T1.7 y T1.8). Implementa SOLO T1.10.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit.

Alcance: packages/core/src/mechanics/xolos.ts (nuevo) y sus tests. Puedes tocar boss.ts y encounter.ts solo para conectarlo. Usa los datos de XOLO y de BOSS_ABILITIES.callOfTheXolos. Reutiliza la IA de enemy.ts y las tablas de threat.ts: no dupliques lógica. Nada de números sueltos.

1. Al resolverse el Llamado (ya está programado solo en fase 2, cada 40 s, el primero al entrar a la fase), aparecen `count` xolos con el centro sobre el muro (20 m de (0,0)): el primero en un ángulo elegido con el RNG del estado y el segundo en el ángulo opuesto.
2. Vida según el número de jugadores del encuentro (XOLO.maxHealthByPlayerCount), armadura, radio, velocidad y auto-ataque de XOLO. Ids deterministas y únicos dentro del encuentro.
3. Cada xolo nace con su propia tabla de amenaza: initialThreat (1) para el Tícitl vivo; si no hay Tícitl vivo, para el jugador vivo más cercano a la posición de aparición (empate por id menor). Su objetivo inicial es ese jugador. Después siguen las reglas normales de amenaza (umbrales, Provocar, Rugido, curación repartida entre todos los enemigos vivos).
4. Los xolos están activos al aparecer (no necesitan pull) y no castean. Los muertos se quedan en entities con vida ≤ 0 y no actúan.
5. En fase 3 no aparecen nuevos (el temporizador ya desaparece en T1.8) y los vivos siguen actuando.

Reglas existentes: step no muta el estado y reutiliza por referencia las entidades sin cambios. Tests con critChance: 0.

Criterios (un test por punto):
1. Al entrar a fase 2 aparecen 2 xolos en el muro, opuestos entre sí, con 300 de vida en un encuentro de 3 jugadores y 600 en uno de 5.
2. Los xolos van primero por el Tícitl; si está muerto, por el jugador vivo más cercano.
3. Rugido o Provocar les cambian el objetivo al Jaguar.
4. En fase 3 no aparecen xolos nuevos y los vivos siguen persiguiendo y atacando.
5. A los 40 s de fase 2 aparece una segunda pareja con ids distintos.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T1.11 — Arena de fase 3 y fin del encuentro

```
Tarea T1.11 — Arena de fase 3 y fin del encuentro.

Lee AGENTS.md, SPEC.md (§6 "Fase 3" y "Fin del encuentro", y §10 "Radio seguro y fin del encuentro"), la tarea T1.11 de PLAN.md y NOTAS.md (secciones T1.7 y T1.8). Implementa SOLO T1.11.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit.

Alcance: packages/core/src/mechanics/arena.ts (nuevo) y sus tests. Puedes tocar encounter.ts y combat.ts solo para conectarlo. Usa BOSS.finalPhaseArena, COMBAT_RULES.arena y los campos safeRadiusMeters y status de EncounterState. Nada de números sueltos.

1. Radio seguro en fase 3 con phaseElapsedTicks = k: 20 − 8 × min(k, 200) / 200 m (calcúlalo con los datos, no con estos números). Fuera de fase 3 es el radio del muro.
2. Cada tick, cada jugador vivo cuyo centro esté a más del radio seguro de (0,0) recibe damagePerTick (5), sin armadura, auras, críticos ni enfurecer. Evento damage con sourceId 'environment' y abilityId 'unsafeGround'. No genera amenaza. Decide y documenta en qué paso del tick se aplica (propuesta: después de que actúan los enemigos).
3. El evento death incluye sourceId y abilityId del golpe letal (ajusta combat.ts y los tests que comparen ese evento).
4. Fin: al final de cada tick, si el jefe tiene vida ≤ 0 → status 'victory'; si no, si todos los jugadores están muertos → 'defeat'. Si ambas, 'victory'. Se emite encounterEnded una sola vez (el tipo ya existe). Después del fin, step solo avanza tick: nadie actúa, no cambian entidades y no hay eventos.

Reglas existentes: step no muta el estado y reutiliza por referencia las entidades sin cambios. Tests con critChance: 0.

Criterios (un test por punto):
1. A los 5 s de entrar a fase 3 el radio seguro es 16 m, y a los 10 s o más, 12 m.
2. Fuera del radio seguro se reciben 100/s (5 por tick), también el Jaguar y con Escudo activo.
3. El estado pasa a victory o defeat según corresponda; si ambas ocurren en el mismo tick, victory.
4. Después del fin, step no produce eventos ni cambia nada salvo tick.
5. El evento death trae el abilityId del golpe letal.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T1.12 — Simulador: bots y runner

```
Tarea T1.12 — Simulador: bots y runner.

Lee AGENTS.md (sobre todo la excepción de packages/core/sim/), SPEC.md (§3, §5, §6 y §10), la tarea T1.12 de PLAN.md y NOTAS.md. Implementa SOLO T1.12.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit. Sin dependencias nuevas.

Alcance: packages/core/sim/bots.ts y packages/core/sim/runner.ts (nuevos) y sus tests. sim/ usa la API pública de core (src/index.ts; puedes exportar ahí lo que falte, sin cambiar lógica). src/ nunca importa sim/. Asegura que sim/ quede cubierto por typecheck, lint y vitest (ajusta tsconfig.test.json o crea uno nuevo si hace falta).

1. Bots: funciones puras (estado → inputs del tick), deterministas, sin RNG propio. Composición por número de jugadores: 3 = Jaguar, Tícitl, Águila; 4 = +1 Águila; 5 = +2 Águilas.
   - Todos: si su centro está en una zona de Viento (o a ≤ 1 m de su borde), se mueven alejándose del centro de la zona y no castean ese tick. Si están fuera del radio seguro o a ≤ 1 m de su borde, se mueven hacia (0,0). No empiezan un casteo mientras se mueven.
   - Tanque: camina al jefe hasta cuerpo a cuerpo (eso hace el pull), lo selecciona, usa Zarpazo cuando puede, Provocar si el jefe o un xolo apunta a otro, Escudo cuando el jefe empieza el Golpe sobre él, y Rugido si hay xolos vivos a ≤ 8 m.
   - Sanador: se queda a unos 15 m del jefe. Copal al aliado vivo sin Copal con menos vida; Remedio al de menor % de vida si está bajo 90 %; Gran remedio si alguien está bajo 50 %; Ofrenda si 2 o más aliados están bajo 70 %.
   - Daño: se queda a unos 15 m del jefe. Prioridad: Grito si el jefe castea Lamento; xolos vivos antes que el jefe; Disparo veloz cuando esté listo; si no, Flecha.
2. Runner: runEncounter({ players, seed, critChance? }) crea el encuentro, aplica los bots cada tick y devuelve el estado final, todos los eventos y los ticks. Límite de seguridad: 18 000 ticks (15 min); si se alcanza, lanza error (el enfurecer garantiza que nunca debería pasar).

Criterios (un test por punto):
1. El runner termina siempre en victory o defeat para 3, 4 y 5 jugadores con varias semillas.
2. Misma semilla da el mismo resultado (estado final y eventos idénticos).
3. Un test verifica que el bot esquiva un círculo de Viento (no recibe su daño).
4. Los bots nunca generan casts rechazados con motivo moving.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde y el reporte del formato de AGENTS.md.
```

---

## T1.13 — Simulador: reporte y CLI

```
Tarea T1.13 — Simulador: reporte y CLI.

Lee AGENTS.md (excepción de packages/core/sim/), la tarea T1.13 de PLAN.md y el runner de T1.12. Implementa SOLO T1.13.

IMPORTANTE: NO ejecutes `npm ci` ni `npm install`: borran node_modules y tu sandbox no tiene red. Usa npm.cmd (Windows PowerShell). No hagas commit. Sin dependencias nuevas.

Alcance: packages/core/sim/report.ts y packages/core/sim/run.ts (nuevos), sus tests y el script `npm run sim` en el package.json raíz.

1. Ejecución sin dependencias nuevas: no hay tsx. Compila sim/ con tsc a una carpeta de salida ignorada por git (agrégala a .gitignore) y ejecútala con node. El script debe funcionar en Windows PowerShell (usa path.join, nada de rm -rf).
2. CLI: `npm run sim -- --players=3 --runs=50` (players de 3 a 5, runs ≥ 1; valida y muestra un error claro si no). Las semillas son 1..runs.
3. report.ts: funciones puras que reciben los resultados del runner y calculan, por número de jugadores:
   - % de victorias
   - duración media en segundos, desde el pull (elapsedTicks)
   - muertes por habilidad (usa el abilityId del evento death)
   - DPS por clase (daño de jugadores / duración) y HPS por clase (curación efectiva / duración)
   - cambios de objetivo del jefe (cuenta cada tick en que su targetId cambia; el runner puede exponerlo)
4. run.ts imprime una tabla legible en español.

Criterios:
1. `npm run sim -- --players=3 --runs=50` termina en menos de 30 s y muestra todas las métricas.
2. Tests de report.ts con resultados sintéticos verifican cada métrica.
3. Argumentos inválidos muestran un error y terminan con código distinto de 0.

Si algo del SPEC es ambiguo, detente y reporta una propuesta. No inventes.
Termina con npm.cmd run check en verde, la salida de `npm run sim -- --players=3 --runs=50` y el reporte del formato de AGENTS.md.
```
