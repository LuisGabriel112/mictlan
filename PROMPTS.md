# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --fresh --model gpt-6-astra --effort xhigh` seguido del texto del bloque.
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

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
