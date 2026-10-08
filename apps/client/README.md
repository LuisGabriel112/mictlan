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

Para jugar el lobby con tres personas, inicia desde PowerShell con:

```powershell
$env:MICTLAN_DEV_MIN_PLAYERS = '3'; npm.cmd run dev
```

Usa la URL que imprima Vite, sin `?dev=1`. Una persona pulsa **Crear sala** y comparte
el código de cuatro letras; las otras lo escriben y pulsan **Unirse**. Elijan un
Jaguar, un Tícitl y uno a tres Águilas (máximo cinco jugadores) y pulsen **Listo**.
Los roles faltantes cuentan solo las clases confirmadas con Listo por el servidor.
Al terminar se muestra el resultado y la duración desde el pull; el servidor regresa
al lobby después de cinco segundos, conservando la clase y desmarcando Listo.

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
- `server=ws://host:2567`: servidor explícito. En Vite, el valor por defecto es el
  hostname de la página en el puerto 2567. En el build servido por `npm.cmd run start`,
  usa el mismo origen de la página (`wss` en HTTPS, `ws` en HTTP, conservando su puerto).
- `code=ABCD`: rellena el código del formulario; **Unirse** confirma la entrada.

## Desarrollo

Para jugar en red local o con amigos en otras redes, sigue la
[guía del servidor](../server/README.md#jugar-con-amigos-t41).

- `npm.cmd run test --workspace @mictlan/client`: tests de la lógica pura (Vitest).
- La escena de Phaser (`src/scene/`) solo dibuja y conecta; se prueba a mano en el navegador.
- Inicio, lobby y resultado usan HTML sobre el canvas: permite un formulario nativo con
  teclado y foco, y conserva la escena de combate durante todo el intento.
