# MICTLÁN — Especificación del MVP (v0.11)

> Nombre de trabajo. Raid cooperativo en navegador, 3–5 jugadores contra un jefe inspirado en la mitología mexica.
> Todos los números son **valores iniciales**: se ajustan con el simulador (tareas T1.12–T1.13) y con playtests.

---

## 1. Visión

- **Qué es:** un solo encuentro de jefe estilo "raid" de WoW: roles (tanque, sanador, daño), combate tab-target, cooldowns, casteos y mecánicas que el grupo debe aprender.
- **Plataforma:** navegador de escritorio. Se entra con un código de sala, sin instalar nada.
- **Vista:** 2D cenital con Phaser hasta el Checkpoint B; en el MVP todo se dibuja con formas de colores (placeholders). **Desde la Fase 5: 3D isométrico con Three.js** (ver §9).
- **Duración de un intento:** 4–7 minutos.
- **Éxito del MVP:** 3 amigos pueden entrar a una sala, pelear contra el jefe completo (3 fases) y ganar o morir. Al terminar, quieren otro intento.

## 2. Fuera de alcance del MVP

Cuentas y login, persistencia, botín, niveles y talentos, más de un jefe, chat, móvil, matchmaking, resurrección, reconexión, arte final, sonido, predicción del lado del cliente, cola de habilidades (spell queue), colisiones entre unidades, línea de visión.

---

## 3. Reglas globales de combate

| Regla | Valor |
|---|---|
| Tick del servidor | 20 Hz (50 ms) fijo |
| Unidad de distancia | metro (1 m = 32 px en el cliente) |
| Muro de la arena | círculo de radio 20 m, centro (0,0). Nadie puede salir: el movimiento se recorta al muro |
| Radio seguro | 20 m al inicio; se reduce en fase 3 (§6). Estar fuera del radio seguro hace daño |
| Velocidad de movimiento | 7 m/s (jugadores), 5 m/s (enemigos) |
| Radio de cuerpo | jugadores 0.5 m, xolos 0.5 m, jefe 1.5 m |
| GCD (cooldown global) | 1.0 s. Lo activan las habilidades marcadas "GCD" |
| Alcance cuerpo a cuerpo | 4 m |
| Alcance a distancia | 30 m |
| Crítico | 10 % de probabilidad, ×1.5. Solo en daño y curación **de jugadores** (habilidades, auto-ataques y ticks de Copal). Enemigos y entorno nunca critican |

**Tiempo y números**
- Todo tiempo interno se cuenta en **ticks enteros** (todos los valores de este documento son múltiplos de 50 ms).
- La probabilidad de crítico es un parámetro del encuentro (`critChance`, por defecto 0.10) para que los tests puedan usar 0.
- Armadura y modificadores se guardan como enteros en puntos base (30 % = 3000) para que `floor` no falle por errores de coma flotante.
- La vida es entera. El maná es decimal internamente y se muestra con `floor`.

**Distancia**
- Distancia a una unidad = distancia entre centros − radio de cuerpo de esa unidad. Ejemplo: un jugador a 5 m del centro del jefe está a 3.5 m (en cuerpo a cuerpo).
- No hay colisiones: las unidades pueden superponerse.

**Orientación**
- Cada jugador mira en la dirección de su último movimiento no nulo. Al inicio mira hacia el jefe.

**Tipo de objetivo de cada habilidad**
- `enemy`: el objetivo actual debe ser un enemigo vivo y en alcance.
- `ally`: el objetivo actual debe ser un aliado vivo y en alcance; puede ser uno mismo.
- `self`: siempre uno mismo; no usa el objetivo actual.
- `none`: área o desplazamiento; no usa el objetivo actual.

**Casteo (jugadores)**
- Una habilidad con tiempo de casteo empieza al presionarla y se resuelve al terminar.
- No se puede **empezar** un casteo mientras el jugador se mueve (se rechaza con motivo `moving`). "Moverse" = el input `move` de ese tick es distinto de (0,0).
- Moverse durante el casteo lo cancela sin consumir recurso ni activar cooldown (el GCD sí queda consumido). Vuelo también cancela el casteo propio.
- El recurso se valida al empezar y se **cobra al resolver**. El cooldown arranca al resolver. El GCD arranca al empezar.
- Si el objetivo muere o sale de alcance al resolverse, el casteo falla sin efecto y sin costo de recurso.
- Solo un casteo activo por unidad.

**Casteo (enemigos)**
- El objetivo se fija al empezar el casteo. Al resolverse **no** se revisa el alcance: si el objetivo sigue vivo, recibe el efecto.
- El enemigo no se mueve ni auto-ataca mientras castea.
- Si a una habilidad le toca empezar mientras hay otro casteo activo, **se encola** y empieza en cuanto termina el actual. Su siguiente uso se cuenta desde el momento en que realmente empezó.

**Validación al presionar una habilidad** (en este orden; si falla, se rechaza con un motivo):
1. La unidad está viva.
2. No está casteando (excepto habilidades "off-GCD" instantáneas).
3. GCD libre (si aplica).
4. Cooldown propio libre.
5. Recurso suficiente.
6. Objetivo válido según el tipo de objetivo (se omite para `self` y `none`).
7. Si tiene tiempo de casteo: el jugador no se está moviendo.

**Daño recibido**
`daño_final = base × (crítico ? 1.5 : 1) × (1 − armadura) × Π(modificadores de auras)` redondeado hacia abajo, mínimo 1.

**Curación**
- `curación_final = base × (crítico ? 1.5 : 1)` redondeado hacia abajo. No supera la vida máxima.
- `curación_efectiva` = lo que realmente subió la vida (sin la sobrecuración).
- La sobrecuración no genera amenaza.

**Muerte:** vida ≤ 0. La unidad muerta no actúa, no es objetivo válido y no genera amenaza. Sin resurrección.

**Determinismo:** toda aleatoriedad usa un RNG con semilla inyectada. Misma semilla + mismas entradas = mismo resultado.

---

## 4. Amenaza (aggro)

- Cada enemigo tiene su propia tabla de amenaza.
- **Daño:** `amenaza = daño_final × modificador_de_clase` (Jaguar ×3, demás ×1).
- **Curación:** `amenaza = curación_efectiva × 0.5`, dividida en partes iguales entre todos los enemigos vivos en ese momento.
- **Amenaza plana** (por ejemplo, la extra de Rugido) no se multiplica por el modificador de clase.
- El enemigo ataca al jugador con más amenaza. Empate: gana el jugador con id menor.
- **Pull sin amenaza (v0.8, decisión de Venegas):** si el jefe se activa por cercanía y ningún jugador vivo tiene amenaza sobre él, toma como objetivo al jugador vivo más cercano (distancia entre centros; empate: id menor) y lo conserva hasta que alguien genere amenaza.
- **Cambio de objetivo:** solo si otro jugador supera al actual en 10 % (si está en cuerpo a cuerpo del enemigo) o en 30 % (si está a más de 4 m).
- **Provocar:** fija la amenaza del tanque en `max(propia, máxima_actual × 1.1)` y fuerza el objetivo por 3 s.

---

## 5. Clases jugables

**Composición obligatoria:** exactamente 1 Guerrero Jaguar, 1 Tícitl y el resto Guerreros Águila (de 1 a 3).

Teclas (v0.11): `1` `2` `3` `4` para habilidades (fila superior o teclado numérico; reemplaza a `Q` `W` `E` `R` de v0.7 porque WASD camina), `Tab` cicla enemigos, clic selecciona, `F1`–`F5` (o `Shift+1`–`Shift+5`) seleccionan aliados. El cliente debe bloquear la acción por defecto del navegador para `Tab` y `F1`–`F5`.

### 5.1 Guerrero Jaguar — Tanque
- **Vida:** 1200. **Armadura:** 30 %. **Amenaza:** ×3.
- **Auto-ataque:** 20 de daño cada 2.0 s si su objetivo enemigo está a ≤ 4 m.

| # | Habilidad | Tipo | Objetivo | Costo/CD | Efecto |
|---|---|---|---|---|---|
| 1 | Zarpazo | Instantánea, GCD, cuerpo a cuerpo | `enemy` | CD 3 s | 40 de daño |
| 2 | Provocar | Instantánea, off-GCD, 30 m | `enemy` | CD 8 s | Ver §4 |
| 3 | Escudo de obsidiana | Instantánea, off-GCD | `self` | CD 18 s | −50 % daño recibido por 6 s |
| 4 | Rugido | Instantánea, GCD, área 8 m alrededor | `none` | CD 8 s | 25 de daño + 50 de amenaza plana a cada enemigo en el área |

### 5.2 Tícitl — Sanador
- **Vida:** 700. **Maná:** 1000, regenera 18/s. **Armadura:** 0.

| # | Habilidad | Tipo | Objetivo | Costo/CD | Efecto |
|---|---|---|---|---|---|
| 1 | Remedio | Casteo 1.5 s, GCD, 30 m | `ally` | 40 maná | Cura 120 |
| 2 | Gran remedio | Casteo 3.0 s, GCD, 30 m | `ally` | 110 maná | Cura 350 |
| 3 | Copal | Instantánea, GCD, 30 m | `ally` | 50 maná | Cura 20 cada 1.0 s durante 10 s (10 ticks, el primero 1 s después de aplicarlo). Recargarlo reinicia la duración y el ritmo de los ticks, no se acumula |
| 4 | Ofrenda | Instantánea, GCD, aliados vivos a ≤ 30 m (incluido uno mismo) | `none` | 150 maná, CD 45 s | Cura 150 a cada uno |

### 5.3 Guerrero Águila — Daño (a distancia)
- **Vida:** 750. **Armadura:** 0.

| # | Habilidad | Tipo | Objetivo | Costo/CD | Efecto |
|---|---|---|---|---|---|
| 1 | Flecha de obsidiana | Casteo 2.0 s, GCD, 30 m | `enemy` | — | 140 de daño |
| 2 | Disparo veloz | Instantánea, GCD, 30 m | `enemy` | CD 6 s | 70 de daño |
| 3 | Grito de guerra | Instantánea, off-GCD, 30 m | `enemy` | CD 15 s | Interrumpe el casteo interrumpible del objetivo. Si el objetivo no está casteando algo interrumpible, se rechaza con motivo `not_casting` y no gasta el CD |
| 4 | Vuelo | Instantánea, off-GCD | `none` | CD 12 s | Desplaza 8 m en la dirección de movimiento (o hacia donde mira si está quieto). Se recorta al muro de la arena (no al radio seguro). Cancela el casteo propio |

**Detalle de Vuelo**
- "Dirección de movimiento" = el `move` de ese tick si es distinto de (0,0); si no, la orientación actual.
- El desplazamiento se aplica en el paso `cast` del tick, después del `move` de ese mismo tick (se suman ambos).
- Es instantáneo: el jugador queda en el destino en ese tick, sin estados intermedios.
- Recortar al muro funciona igual que en el movimiento normal: el **centro** del jugador queda a ≤ 20 m de (0,0).
- Si el jugador estaba casteando, el casteo se cancela (sin costo ni cooldown) antes del desplazamiento.
- No cambia la orientación por sí mismo: la orientación solo cambia con `move`.

### 5.4 Ayuda en el juego (T4.3, v0.9)

**Tipo de cada habilidad** (etiqueta en la barra de acción y en el panel de clase): Zarpazo, Flecha de obsidiana y Disparo veloz → **daño**; Remedio, Gran remedio, Copal y Ofrenda → **cura**; Escudo de obsidiana → **defensa**; Provocar, Rugido y Grito de guerra → **control**; Vuelo → **movilidad**.

**Controles comunes** (en todas las guías): W A S D caminan (o clic derecho), X se detiene, Tab cambia de enemigo, clic selecciona, F1–F5 seleccionan aliados, 1 2 3 4 lanzan habilidades.

**Guía del Guerrero Jaguar (tanque)**
- **Tu trabajo:** que el jefe te pegue a ti y no a los demás. Ponte frente a él (a 4 m o menos) y no te alejes.
- **Rotación:** Zarpazo (1) cada vez que esté listo. Rugido (4) al empezar y cuando aparezcan xolos. Provocar (2) si el jefe o un xolo se va con otro jugador.
- **Lo más importante:** cuando el jefe castee **Golpe del Descarnado** sobre ti (no se puede interrumpir), usa Escudo de obsidiana (3) antes de que termine: sin Escudo recibes 280, con Escudo 140.
- **Evita:** los círculos rojos de Viento de obsidiana; en la fase 3, salir del círculo seguro.
- **Con tu grupo:** mantén al jefe cerca del centro; en la fase 2 atrae a los xolos, que van por el Tícitl.

**Guía del Tícitl (sanador)**
- **Tu trabajo:** mantener vivos a todos, sobre todo al Jaguar. Selecciona aliados con F1–F5 o con clic en su marco.
- **Rotación:** Copal (3) siempre activo en el Jaguar. Remedio (1) para el daño normal. Gran remedio (2) cuando alguien esté bajo y tengas 3 s. Ofrenda (4) justo después de un Lamento de los muertos, que golpea a todos.
- **Maná:** regenera 18 por segundo; no gastes Gran remedio en alguien casi lleno.
- **Evita:** los círculos rojos de Viento; sal antes de empezar un casteo largo. En la fase 2 los xolos van por ti: acércate al Jaguar.
- **Con tu grupo:** avisa cuando te quedes sin maná.

**Guía del Guerrero Águila (daño a distancia)**
- **Tu trabajo:** hacer daño desde lejos y cortar el Lamento de los muertos.
- **Rotación:** Disparo veloz (2) cada vez que esté listo; Flecha de obsidiana (1) el resto del tiempo (2 s de casteo).
- **Lo más importante:** cuando el jefe castee **Lamento de los muertos** (borde turquesa: se puede interrumpir), usa Grito de guerra (3) con el jefe seleccionado: lo cancela y nadie recibe daño. Si hay varios Águilas, túrnense.
- **Evita:** los círculos rojos de Viento: sal caminando o con Vuelo (4, 8 m). En la fase 3, quédate dentro del círculo seguro.
- **Con tu grupo:** en la fase 2, mata primero a los xolos (Tab para seleccionarlos).

---

## 6. El jefe: Mictlantecuhtli, Señor del Mictlán

- **Vida según número de jugadores:** 3 → 7 500, 4 → 12 500, 5 → 17 500 (v0.10, **temporal** para el playtest: con 15 000/25 000/35 000 (v0.9) y 24 000/40 000/56 000 (v0.7) los humanos no pasaban de la fase 1 y la partida no era divertida; se fija el valor definitivo con los datos de T4.4). **Armadura:** 0. **Radio de cuerpo:** 1.5 m.
- **Modo dev (1–2 jugadores):** solo para pruebas. El jefe y los xolos usan los valores de 3 jugadores. Ver §7.
- **Auto-ataque:** 60 de daño cada 2.0 s a su objetivo, si está a ≤ 4 m. Si no, camina hacia él a 5 m/s.
- **Enfurecer:** a los 480 s del pull, todo el daño del jefe ×5 (auto-ataque, Golpe, Lamento y Viento). No afecta a los xolos ni al daño por salir del radio seguro.

### Inicio del combate
- Al pasar la sala a combate, el jefe está en (0,0) inactivo. Los jugadores aparecen en fila en y = −15 m, separados 2 m, centrados en x = 0.
- **Pull:** el primer tick en que un jugador genera amenaza sobre el jefe o se acerca a ≤ 10 m de él. Desde ese tick cuentan el reloj del encuentro, los temporizadores de fase 1 y el enfurecer.

### Temporizadores
- Al entrar a una fase, todas sus habilidades reinician su temporizador con los valores de esta tabla ("primero" se cuenta desde la entrada a la fase).

| Habilidad | Fase 1 (primero / cada) | Fase 2 | Fase 3 |
|---|---|---|---|
| Golpe del Descarnado | 10 s / 20 s | 10 s / 20 s | 10 s / 20 s |
| Viento de obsidiana | 6 s / 15 s | 6 s / 12 s | — |
| Lamento de los muertos | 14 s / 25 s | 14 s / 25 s | 8 s / 18 s |
| Llamado de los xolos | — | 0 s / 40 s | — |

**Cambio de fase:** se evalúa al final de cada tick con enteros: fase 2 si `vida × 100 ≤ máx × 65`, fase 3 si `vida × 100 ≤ máx × 30`. Un casteo en curso termina normalmente. La nueva fase aplica desde el tick siguiente.

### Habilidades
| Habilidad | Detalle |
|---|---|
| Golpe del Descarnado | Casteo 2.5 s **no interrumpible** sobre su objetivo: 400 de daño. El tanque debe usar Escudo |
| Viento de obsidiana | No es casteo (puede ocurrir durante otro casteo). Marca círculos de **4 m de radio** bajo 3 jugadores vivos elegidos con el RNG (o todos si hay menos). Cada círculo queda fijo donde estaba el jugador. Aviso de 2.0 s; luego 200 de daño a cada jugador dentro de cada círculo (los círculos superpuestos suman daño) |
| Lamento de los muertos | Casteo 3.0 s **interrumpible**: 250 de daño a todos los jugadores vivos |
| Llamado de los xolos | No es casteo. Invoca 2 Xolos espectrales en el muro de la arena, en ángulos opuestos (el primer ángulo lo elige el RNG) |

### Fase 1 — "Los nueve ríos" (100 % → 65 %)
Golpe del Descarnado, Viento de obsidiana y Lamento de los muertos.

### Fase 2 — "Los guías" (65 % → 30 %)
- Las tres habilidades de fase 1 (Viento más frecuente) más Llamado de los xolos.
- **Xolo espectral:** vida `150 + 150 × (jugadores − 2)` (3 → 300, 5 → 600), armadura 0, radio de cuerpo 0.5 m, auto-ataque de 25 cada 1.5 s a ≤ 4 m, velocidad 5 m/s.
  - Tabla de amenaza propia. Al aparecer dan 1 de amenaza al Tícitl (si está muerto, al jugador vivo más cercano), así que van por él hasta que el tanque los provoque o use Rugido.

### Fase 3 — "Río Apanohuaya" (30 % → 0 %)
- Al entrar, el radio seguro se reduce de 20 m a 12 m de forma lineal durante 10 s. El muro sigue en 20 m.
- Cada jugador fuera del radio seguro recibe 5 de daño por tick (100/s). Ignora armadura, auras y críticos.
- Golpe del Descarnado y Lamento de los muertos (más frecuente). Viento de obsidiana se desactiva.
- Los xolos vivos permanecen. No aparecen nuevos.

### Fin del encuentro
- **Victoria:** el jefe llega a 0 de vida (aunque queden xolos).
- **Derrota:** todos los jugadores muertos.
- Si ambas ocurren en el mismo tick, gana la victoria.
- En ambos casos, 5 s después la sala vuelve al lobby con el estado reiniciado.

---

## 7. Arquitectura

```
mictlan/
├─ packages/core     # Motor de combate. TypeScript puro y determinista. Sin red, sin DOM, sin Date/Math.random
│  └─ sim/           # Simulador de balance (CLI). Usa core; no está sujeto a la regla de pureza
├─ apps/server       # Servidor Colyseus. Corre core a 20 Hz y sincroniza estado
└─ apps/client       # Vite + Phaser. Solo dibuja y manda entradas
```

- **Monorepo** con npm workspaces y TypeScript estricto. Tests con Vitest.
- **El servidor es la autoridad:** el cliente nunca decide daño, vida ni posiciones finales.
- **API central de core:**
  - `createEncounter(config, seed) → EncounterState`, con `config = { players: [{ id, classId }], critChance?, devMode? }`.
  - Sin `devMode`, `createEncounter` exige de 3 a 5 jugadores. Con `devMode: true` acepta de 1 a 5; con 1 o 2 jugadores, el jefe y los xolos usan los valores de 3 (§6). Core no valida la composición de clases: eso lo hace el lobby (§5).
  - El servidor activa `devMode` solo si `MICTLAN_DEV_MIN_PLAYERS` < 3.
  - `step(state, inputs, dtMs) → { state, events }` avanza **exactamente un tick**: `dtMs` debe ser 50, si no lanza error. Es pura: no muta el estado recibido.
  - Las entradas de un tick se procesan ordenadas por id de jugador. Como máximo un `cast` por jugador y tick; si llegan varios `move`, vale el último.
  - Los `events` (daño, curación, inicio/fin/cancelación de casteo, rechazo con motivo, muerte, cambio de fase…) los usan el log de combate, el texto flotante y el simulador. Todo evento de daño o curación incluye `sourceId` y `abilityId`.
- **Datos como datos:** clases, habilidades y jefe se definen como objetos de configuración en `packages/core/src/data/`, no como lógica dispersa.

### Mensajes cliente → servidor
| Mensaje | Payload |
|---|---|
| `moveTo` | `{ x, y }` destino en metros. El servidor mueve al jugador hacia él cada tick hasta llegar (a menos de un paso) y recorta destinos fuera del muro. Es lo que usa el cliente (clic derecho) |
| `stop` | `{}` cancela el destino y cualquier dirección sostenida |
| `move` | `{ dx, dy }` dirección sostenida (vector normalizado o (0,0)). Se conserva para pruebas y bots; el cliente ya no lo usa |
| `target` | `{ entityId }` |
| `cast` | `{ abilityId }` (usa el objetivo actual) |
| `ready` | `{ classId }` en el lobby. Se rechaza si rompe la composición obligatoria (§5) |

### Estado sincronizado
Entidades (id, tipo, clase, x, y, vida, vida máx., recurso, objetivo, casteo actual con progreso, auras), zonas activas, fase, radio seguro, tiempo de encuentro y estado de la sala (`lobby | combat | victory | defeat`). Los identificadores van en inglés; el cliente los traduce al mostrarlos.

---

## 8. Interfaz (MVP)

- Marco propio (vida y recurso) y marco del objetivo, con su barra de casteo.
- Marcos de grupo (hasta 5), clicables.
- Barra de acción Q/W/E/R con cooldown visible y estado "sin recurso" o "fuera de alcance".
- Barra de casteo propia y del jefe. Si el casteo es interrumpible, se marca con un borde distinto.
- Zonas de peligro como círculos rojos translúcidos que se llenan durante el aviso. El radio seguro se dibuja como un círculo.
- Texto flotante de daño y curación. Log de combate en una esquina.
- Lobby: crear sala (código de 4 letras), unirse, elegir clase, "listo". La partida inicia cuando todos están listos, hay de 3 a 5 jugadores y se cumple la composición obligatoria.

**Placeholders:** Jaguar = círculo naranja, Tícitl = verde, Águila = azul, Jefe = morado grande, Xolo = gris.

## 9. Dirección de arte (después del MVP)

Estética de códice y Día de Muertos: paleta de ocres, negro obsidiana y turquesa. **Todo el arte debe ser propio** o con licencia de uso libre (por ejemplo, CC0).

**Ambiente objetivo (Fase 5, Three.js):** referencias de Venegas: una banda de WoW (áreas de daño en el suelo que brillan), la jungla de LoL (cámara isométrica, barra de vida sobre cada unidad, arena circular con borde de piedra) y V Rising (oscuro, luces frías de color, viñeta).
- Cámara isométrica fija sobre la arena; el combate sigue siendo plano (x, y del core); la altura es solo visual.
- Escena oscura: fondo obsidiana, luz ambiental baja, sombras y viñeta.
- Luz turquesa como acento (aura del jefe, brillos de casteo); el peligro siempre en rojo/naranja de fuego, con bloom.
- Las áreas de daño brillan y se leen de un vistazo sobre el piso oscuro.
- Barra de vida compacta sobre cada unidad, con marco oscuro (estilo LoL). El HUD (marcos, barra de acción, log) es HTML sobre el canvas, como el lobby.
- Partículas breves en golpes, curaciones y casteos; nada que tape las áreas de daño.
- Modelos: primero formas simples con luz; después personajes y escenario 3D con licencia CC0 o propios (glTF), con animaciones de caminar, atacar, castear y morir.
- La legibilidad manda: si un efecto compite con un aviso de peligro, se atenúa el efecto.

---

## 10. Aclaraciones de implementación (v0.4)

Estas reglas no cambian ningún número; cierran huecos que el texto anterior dejaba abiertos.

**Habilidades del jefe sin casteo** (Viento, Llamado de los xolos)
- Emiten solo `abilityResolved`, no `castStarted`.

**Viento de obsidiana**
- Los objetivos se eligen con el RNG, sin repetir, entre los jugadores vivos ordenados por id.
- Un jugador está "dentro" de un círculo si la distancia entre su **centro** y el centro del círculo es ≤ 4 m (no se suma su radio de cuerpo).
- El daño usa la fórmula de "Daño recibido": aplican armadura, Escudo y enfurecer.
- Un círculo ya marcado explota aunque el jefe cambie de fase antes de que termine el aviso. Si el jefe muere, solo explotan los círculos que vencen en ese mismo tick; el resto queda congelado sin efecto por el fin del encuentro.

**Lamento de los muertos e interrupción**
- El daño usa la fórmula de "Daño recibido": aplican armadura, Escudo y enfurecer.
- Interrumpir emite `castCancelled` con motivo `interrupted`. El siguiente Lamento se cuenta desde que empezó el interrumpido.
- Grito de guerra revisa "el objetivo castea algo interrumpible" justo después del paso 6 de la validación (§3). Si falla, se rechaza con `not_casting` sin activar su cooldown.
- Los casteos de jugadores **no** son interrumpibles.

**Xolos**
- Aparecen con el centro sobre el muro (a 20 m de (0,0)).
- "Jugador vivo más cercano" se mide desde la posición de aparición del xolo; empate por id menor.
- Sus ids son deterministas y únicos dentro del encuentro.

**Radio seguro y fin del encuentro**
- Radio seguro con `phaseElapsedTicks = k` en fase 3: `20 − 8 × min(k, 200) / 200` m. Con k = 100 vale 16 m.
- Un jugador está fuera si la distancia de su centro a (0,0) es mayor que el radio seguro.
- El daño de la arena tiene `sourceId: 'environment'` y `abilityId: 'unsafeGround'`, y no genera amenaza.
- Al terminar (`victory` o `defeat`) se emite `encounterEnded` una sola vez. Después, `step` solo avanza `tick`: nadie actúa y no hay más eventos. La vuelta al lobby es del servidor (T2.4).
- El evento `death` incluye `sourceId` y `abilityId` del golpe letal.

**Movimiento sostenido (v0.6, T3.1)**
- `move { dx, dy }` es una dirección sostenida: el servidor la repite en cada tick hasta recibir otra, o `(0,0)` para detenerse. El cliente solo envía `move` cuando cambia la dirección de las teclas, y suelta todo si la ventana pierde el foco.
- Las demás entradas (`target`, `cast`) se consumen en el siguiente tick, como antes.
- El estado sincronizado incluye, por jugador, `gcdRemainingTicks` y los cooldowns en curso (`cooldowns`, solo los mayores que 0), para que la barra de acción muestre la disponibilidad.

**Movimiento con clic derecho (v0.7, T3.7)**
- El cliente se mueve como en LoL: clic derecho en la arena = `moveTo` a ese punto; tecla S = `stop`. No hay WASD.
- Un `moveTo` reemplaza al destino anterior y a cualquier `move` sostenido; un `move` olvida el destino.
- El jugador se detiene a menos de un paso (0.35 m) del destino; morir o desconectarse olvida el destino.
- Pedir una habilidad con tiempo de casteo detiene el movimiento antes del tick, así el casteo empieza en vez de rechazarse por `moving`. Las instantáneas (incluido Vuelo) no lo detienen.

---

## 11. Raid ágil (v0.11, aprobado por Venegas el 2026-10-09)

Motivo: tras probar el cliente 3D, Venegas pidió un raid "más ágil": menos clic y casteo largo, más movimiento y mecánicas que se esquivan. Estas reglas **reemplazan** a las anteriores donde choquen.

**Movimiento**
- WASD mueve al jugador en dirección relativa a la cámara isométrica (W = arriba en pantalla). El cliente convierte la tecla a una dirección del core y envía el `move { dx, dy }` existente; soltar todas las teclas envía `move { 0, 0 }`. El clic derecho (`moveTo`) se conserva. Moverse sigue cancelando los casteos.
- `S` deja de ser "detener" (ahora es mover abajo). Detener = soltar WASD o la tecla `X`.

**Esquiva (todas las clases)**
- `Espacio` = **Esquiva**: desplaza 4 m en la dirección de movimiento (o hacia donde mira si está quieto), instantánea, off-GCD, sin costo, recarga 8 s. Cancela el casteo propio. Se recorta al muro como Vuelo. No es una de las 4 habilidades de la barra.
- Vuelo del Águila no cambia (8 m, CD 12 s).

**Auto-ataque para todos** (además del Jaguar, sin cambios)
- Guerrero Águila: 15 de daño cada 2.0 s si su objetivo enemigo está a ≤ 30 m.
- Tícitl: 10 de daño cada 2.0 s si su objetivo enemigo está a ≤ 30 m.
- Los auto-ataques se pausan mientras castea, igual que el del Jaguar.

**Casteos más cortos**
- Flecha de obsidiana: casteo 2.0 s → **1.5 s**.
- Gran remedio: casteo 3.0 s → **2.0 s**.

**Golpe del Descarnado telegrafiado**
- Ya no golpea solo a su objetivo: al empezar el casteo (2.5 s, no interrumpible) fija un **cono frontal de 90° y 8 m** hacia su objetivo, visible en el suelo. Al terminar, 400 de daño a **cada jugador dentro del cono** (Escudo lo reduce igual). El Jaguar lo recibe con Escudo; los demás salen del cono.
- Si el objetivo muere o se aleja durante el casteo, el cono no gira: queda fijo donde se marcó.

**Lamento de los muertos**
- Mismas reglas (3.0 s, interrumpible, 250 a todos); el cliente lo anuncia con un aviso grande en pantalla y el anillo turquesa de T5.1b.

**Balance**
- Tras el cambio, rebalancear la vida del jefe con el simulador (los bots usan WASD/Esquiva solo si el cambio de reglas lo exige) y mantener el test de duración de T4.5 en rango.

**Teclas (decisión de Venegas, v0.11):** WASD choca con la `W` de las habilidades, así que las habilidades pasan a `1` `2` `3` `4` (fila superior o teclado numérico). `Shift+1`–`Shift+5` siguen seleccionando aliados. Las guías de §5.4 usan los números.
