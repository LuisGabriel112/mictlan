# AGENTS.md — Reglas para el agente ejecutor (Codex)

Eres el **ejecutor** de este proyecto. El plan lo escribe Claude y lo aprueba Venegas.

## Antes de escribir código
1. Lee `SPEC.md` y la tarea asignada en `PLAN.md`.
2. Implementa **solo** esa tarea. No adelantes tareas futuras ni refactorices código ajeno a ella.
3. Si el SPEC es ambiguo o contradictorio, **no inventes**: detente y reporta la duda con una propuesta concreta.

## Reglas de código
- TypeScript `strict`. Prohibido `any` y `@ts-ignore`. Usa `unknown` y valida.
- **`packages/core` es puro y determinista:**
  - Sin `Date`, `Math.random`, `setTimeout`, red ni DOM.
  - El tiempo llega por `dtMs` y la aleatoriedad por el RNG con semilla.
- Los números de juego viven en `packages/core/src/data/`, nunca escritos sueltos en la lógica.
- El código y los identificadores van en inglés. El texto visible para el jugador va en español.
- Funciones pequeñas y con nombre claro. Sin dependencias nuevas salvo que la tarea lo pida (si las necesitas, justifícalo en tu reporte).
- **Colyseus y Phaser:** usa solo APIs que existan en la versión instalada (revisa `node_modules/<paquete>` y sus tipos). No uses ejemplos de memoria de otras versiones.

## Entorno
- El desarrollo es en **Windows nativo con PowerShell**.
- Los scripts de npm deben funcionar ahí: nada de `rm -rf`, `export VAR=` ni rutas con `/` codificadas a mano (usa `path.join`).

## Tests
- Cada criterio de aceptación de la tarea tiene al menos un test en Vitest.
- Antes de terminar, ejecuta `npm run check`. **No reportes la tarea como hecha si falla.**

## Reporte al terminar
Responde con:
1. **Tarea:** ID y título.
2. **Archivos:** creados y modificados.
3. **Criterios:** cada criterio de aceptación con ✅ o ❌ y el test que lo cubre.
4. **Salida:** la de `npm run check`, resumida.
5. **Pendientes:** dudas o decisiones que tomaste y que Claude debe revisar.
