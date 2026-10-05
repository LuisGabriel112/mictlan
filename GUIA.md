# GUÍA — Flujo Claude (planea) + Codex (ejecuta) para MICTLÁN

Esta guía es para Windows nativo con PowerShell. Síguela en orden.

---

## Paso 0 — Instalar herramientas (una sola vez)

Abre **PowerShell** y ejecuta:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Cierra y vuelve a abrir PowerShell. Luego instala los dos agentes:

```powershell
irm https://claude.ai/install.ps1 | iex
npm install -g @openai/codex
codex login
```

`codex login` abre el navegador: entra con tu cuenta de ChatGPT Plus.

Verifica que todo quedó instalado:

```powershell
node -v; git --version; claude --version; codex --version
```

> Si `irm ... | iex` falla, instala Claude Code con `npm install -g @anthropic-ai/claude-code`.

---

## Paso 1 — Crear el proyecto

```powershell
mkdir C:\dev\mictlan; cd C:\dev\mictlan
git init
```

Copia a esa carpeta los 5 archivos: `SPEC.md`, `PLAN.md`, `AGENTS.md`, `CLAUDE.md` y `GUIA.md`. Después:

```powershell
git add -A; git commit -m "docs: spec y plan inicial"
```

---

## Paso 2 — Conectar Codex dentro de Claude Code

```powershell
claude
```

Dentro de Claude Code, ejecuta uno por uno:

```
/plugin marketplace add openai/codex-plugin-cc
/plugin install codex@openai-codex
/reload-plugins
/codex:setup
```

`/codex:setup` debe decir que Codex está listo. Si pide login: `!codex login`.

---

## Paso 3 — Que Claude cuestione el plan antes de empezar

Activa el **modo plan** con `Shift+Tab` hasta ver "plan mode" y pega:

```
Lee CLAUDE.md, SPEC.md y PLAN.md. Antes de que Codex empiece, revisa el SPEC como diseñador de juegos y como ingeniero:
1) contradicciones o huecos que obligarían a Codex a inventar,
2) números que se vean claramente rotos,
3) tareas del PLAN demasiado grandes para una sola entrega.
Propón cambios concretos. No edites nada todavía.
```

Lee su propuesta. Acepta solo lo que te convenza y pídele: `Aplica los cambios 1, 3 y 4`. Luego haz commit.

---

## Paso 4 — Ciclo por tarea (repítelo para cada tarea del PLAN)

### 4.1 Punto de partida limpio
```powershell
git status
```
Debe decir que no hay cambios. Si hay, haz commit o descártalos antes de seguir.

### 4.2 Delegar a Codex
En Claude Code (cambia `T0.1` por la tarea que toque):
```
/codex:rescue Implementa SOLO la tarea T0.1 de PLAN.md. Sigue AGENTS.md y SPEC.md al pie de la letra. Al terminar ejecuta npm run check y responde con el formato de reporte de AGENTS.md. Si algo del SPEC es ambiguo, detente y pregunta en lugar de inventar.
```
Para ver cómo va: `/codex:status`. Para leer el resultado: `/codex:result`.

> **Plan B si el plugin falla:** abre otra ventana de PowerShell en `C:\dev\mictlan`, ejecuta `codex` y pega el mismo prompt sin `/codex:rescue`.

### 4.3 Revisión de Claude
```
Revisa la entrega de Codex para T0.1 siguiendo CLAUDE.md. Corre npm run check y git diff. Responde con el formato de revisión.
```

### 4.4 Según el veredicto
- **CAMBIOS REQUERIDOS:** devuélvelos a Codex:
  ```
  /codex:rescue Corrige la tarea T0.1 según esta revisión: <pega las correcciones de Claude>. Vuelve a correr npm run check y repórtame.
  ```
  Luego regresa al paso 4.3.
- **APROBADA:** guarda el avance:
  ```powershell
  git add -A; git commit -m "<commit sugerido por Claude>"
  ```

### 4.5 Regla de los 3 rebotes
Si una tarea rebota **3 veces**, el problema no es Codex: la tarea o el SPEC están mal planteados. Pídele a Claude:
```
T0.1 rebotó 3 veces. Diagnostica si el problema es el SPEC, el tamaño de la tarea o los criterios. Propón cómo dividirla o aclararla.
```

---

## Paso 5 — Checkpoints

- **Checkpoint A** (después de T1.9): corre `npm run sim -- --players=3 --runs=50` y pásale el resultado a Claude:
  ```
  Este es el reporte del simulador: <pega>. Compáralo con la duración objetivo de 4 a 7 minutos y con las causas de muerte. Propón ajustes de números al SPEC, máximo 5, explicando cada uno.
  ```
- **Fase 3 (cliente):** aquí entras tú. Las tareas T3.x se validan jugando, no con tests. Abre 2 o 3 pestañas y prueba antes de aprobar.
- **Checkpoint B** (después de jugar con amigos): anota qué fue divertido, qué fue injusto y qué no se entendió. Pásaselo a Claude para que lo convierta en cambios al SPEC y en tareas nuevas.

---

## Hábitos que ahorran dolor

- **Un commit por tarea aprobada.** Si Codex rompe algo, regresas con `git checkout .`.
- **Nunca edites a mano el código que Codex está tocando en ese momento.**
- **Si se te acaba el límite de Codex**, espera o pídele a Claude que implemente esa tarea. Anótalo para saber cuánto usaste cada herramienta.
- **Lleva un registro** en `NOTAS.md` de lo que observes: tarea, rebotes, qué detectó la revisión de Claude. Al final del trial, eso te dirá si el combo vale la pena.
