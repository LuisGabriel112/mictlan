# PROMPTS — Tareas listas para delegar a Codex

Cada bloque se lanza con `/codex:rescue --fresh --model gpt-6-astra --effort xhigh` seguido del texto del bloque.
Antes de lanzar una tarea, confirma con `git log` que la anterior ya tiene commit.
Claude borra de aquí cada prompt cuando su tarea queda aprobada.

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
