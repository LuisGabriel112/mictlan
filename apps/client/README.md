# Cliente de Mictlán

Vite + Phaser 3.90 + `@colyseus/sdk`. Solo dibuja y manda entradas; el servidor decide todo.

## Jugar en local

Desde la raíz del repo (PowerShell):

```powershell
npm.cmd run dev
```

Levanta el servidor (puerto 2567) y el cliente (Vite, normalmente `http://localhost:5173`).
Por defecto `MICTLAN_DEV_MIN_PLAYERS=1`, así que una sola pestaña puede pelear.

Abre `http://localhost:5173/?dev=1&class=eagle`. Clases: `jaguar`, `healer`, `eagle`.

Para ver a dos jugadores juntos, el servidor debe esperar a ambos:

```powershell
$env:MICTLAN_DEV_MIN_PLAYERS = '2'; npm.cmd run dev
```

y abre dos pestañas, por ejemplo `?dev=1&class=jaguar` y `?dev=1&class=healer`.
En modo dev no se puede repetir Jaguar ni Tícitl; Águilas, las que quieras.

## Controles

| Tecla | Acción |
|---|---|
| Clic derecho | Caminar hasta ese punto (como en LoL) |
| S | Detenerse |
| Tab | Siguiente enemigo, del más cercano al más lejano |
| Clic | Seleccionar la unidad bajo el puntero |
| F1–F5 o Shift+1–5 | Seleccionar aliado (1 = tú, luego los demás) |
| Q W E R | Habilidades de tu clase (los números no castean) |

Pedir una habilidad con tiempo de casteo (Flecha, Remedio…) te detiene y la lanza.

La barra de acción muestra la recarga y por qué una habilidad no está disponible
(GCD, sin maná, lejos, sin objetivo). Si el servidor rechaza una habilidad, aparece el motivo.

## Parámetros de la URL

- `dev=1`: se une a una sala abierta (o crea una) y marca listo con `class`.
- `class=jaguar|healer|eagle`: clase en modo dev (por defecto `eagle`).
- `server=ws://host:2567`: servidor (por defecto, el mismo host de la página en el puerto 2567).
- `code=ABCD`: unirse a una sala por código (sin modo dev; el lobby jugable llega en T3.5).

## Desarrollo

- `npm.cmd run test --workspace @mictlan/client`: tests de la lógica pura (Vitest).
- La escena de Phaser (`src/scene/`) solo dibuja y conecta; se prueba a mano en el navegador.

## Lectura del combate

- Arriba al centro: tiempo desde el pull y nombre de fase; debajo, el casteo del jefe.
- Abajo a la derecha, sobre la zona de acciones: las últimas 12 entradas del combate.
  Las muertes incluyen la habilidad y su autor; las curaciones muestran solo la cantidad efectiva.
- Los números duran un segundo y suben: daño blanco, daño crítico amarillo y más grande,
  curación verde con `+` (también más grande si es crítica). Se ocultan al cruzar los paneles
  del HUD, para no tapar marcos, casteos, log ni acciones.
- Viento tiene un contorno pulsante durante el aviso. El área entre el radio seguro y el
  muro queda sombreada en rojo cuando la arena se contrae.

La lógica pura está en `combat-log.ts`, `floating-text.ts`, `encounter-clock.ts`,
`danger-view.ts` y `hud-layout.ts`, con tests en `tests/`.
