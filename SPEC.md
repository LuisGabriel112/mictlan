# MICTLÁN — Especificación del MVP (v0.1)

> Nombre de trabajo. Raid cooperativo en navegador, 3–5 jugadores contra un jefe inspirado en la mitología mexica.
> Todos los números son **valores iniciales**: se ajustan con el simulador (tarea T1.9) y con playtests.

---

## 1. Visión

- **Qué es:** un solo encuentro de jefe estilo "raid" de WoW: roles (tanque, sanador, daño), combate tab-target, cooldowns, casteos y mecánicas que el grupo debe aprender.
- **Plataforma:** navegador de escritorio. Se entra con un código de sala, sin instalar nada.
- **Vista:** 2D cenital. En el MVP todo se dibuja con formas de colores (placeholders).
- **Duración de un intento:** 4–7 minutos.
- **Éxito del MVP:** 3 amigos pueden entrar a una sala, pelear contra el jefe completo (3 fases) y ganar o morir. Al terminar, quieren otro intento.

## 2. Fuera de alcance del MVP

Cuentas y login, persistencia, botín, niveles y talentos, más de un jefe, chat, móvil, matchmaking, resurrección, arte final, sonido, predicción del lado del cliente.

---

## 3. Reglas globales de combate

| Regla | Valor |
|---|---|
| Tick del servidor | 20 Hz (50 ms) fijo |
| Unidad de distancia | metro (1 m = 32 px en el cliente) |
| Arena | círculo de radio 20 m, centro (0,0) |
| Velocidad de movimiento | 7 m/s (jugadores), 5 m/s (adds) |
| GCD (cooldown global) | 1.0 s. Lo activan las habilidades marcadas "GCD" |
| Alcance cuerpo a cuerpo | 4 m |
| Alcance a distancia | 30 m |
| Crítico | 10 % de probabilidad, ×1.5 (daño y curación) |
| Línea de visión | no existe en el MVP |

**Casteo**
- Una habilidad con tiempo de casteo empieza al presionarla y se resuelve al terminar.
- Moverse cancela el casteo, sin consumir recursos ni activar cooldown (el GCD sí queda consumido).
- Si el objetivo muere o sale de alcance al resolverse, el casteo falla sin efecto y sin costo de recurso.
- Solo un casteo activo por unidad.

**Validación al presionar una habilidad** (en este orden; si falla, se rechaza con un motivo):
1. La unidad está viva.
2. No está casteando (excepto habilidades "off-GCD" instantáneas).
3. GCD libre (si aplica).
4. Cooldown propio libre.
5. Recurso suficiente.
6. Objetivo válido (tipo correcto, vivo, en alcance).

**Daño recibido**
`daño_final = base × (crítico ? 1.5 : 1) × (1 − armadura) × Π(modificadores de auras)` redondeado hacia abajo, mínimo 1.

**Curación**
- `curación_final = base × (crítico ? 1.5 : 1)`. No supera la vida máxima.
- La sobrecuración no genera amenaza.

**Muerte:** vida ≤ 0. La unidad muerta no actúa, no es objetivo válido y no genera amenaza. Sin resurrección.

**Determinismo:** toda aleatoriedad usa un RNG con semilla inyectada. Misma semilla + mismas entradas = mismo resultado.

---

## 4. Amenaza (aggro)

- Cada enemigo tiene su propia tabla de amenaza.
- **Daño:** `amenaza = daño_final × modificador_de_clase` (Jaguar ×3, demás ×1).
- **Curación:** `amenaza = curación_efectiva × 0.5`, dividida en partes iguales entre todos los enemigos vivos.
- El enemigo ataca al jugador con más amenaza.
- **Cambio de objetivo:** solo si otro jugador supera al actual en 10 % (cuerpo a cuerpo) o 30 % (a distancia, desde más de 4 m).
- **Provocar:** fija la amenaza del tanque en `máxima_actual × 1.1` y fuerza el objetivo por 3 s.

---

## 5. Clases jugables

Teclas: `1` a `4` para habilidades, `Tab` cicla enemigos, clic selecciona, `F1`–`F5` seleccionan aliados.

### 5.1 Guerrero Jaguar — Tanque
- **Vida:** 1200. **Armadura:** 30 %. **Amenaza:** ×3.
- **Auto-ataque:** 20 de daño cada 2.0 s si el objetivo enemigo está a ≤ 4 m.

| # | Habilidad | Tipo | Costo/CD | Efecto |
|---|---|---|---|---|
| 1 | Zarpazo | Instantánea, GCD, cuerpo a cuerpo | CD 3 s | 40 de daño |
| 2 | Provocar | Instantánea, off-GCD, 30 m | CD 8 s | Ver §4 |
| 3 | Escudo de obsidiana | Instantánea, off-GCD, propia | CD 30 s | −50 % daño recibido por 6 s |
| 4 | Rugido | Instantánea, GCD, área 8 m alrededor | CD 8 s | 25 de daño + 50 de amenaza extra a cada enemigo |

### 5.2 Tícitl — Sanador
- **Vida:** 700. **Maná:** 1000, regenera 8/s. **Armadura:** 0.

| # | Habilidad | Tipo | Costo/CD | Efecto |
|---|---|---|---|---|
| 1 | Remedio | Casteo 1.5 s, GCD, aliado 30 m | 40 maná | Cura 120 |
| 2 | Gran remedio | Casteo 3.0 s, GCD, aliado 30 m | 110 maná | Cura 350 |
| 3 | Copal | Instantánea, GCD, aliado 30 m | 50 maná | Cura 20 por segundo durante 10 s. Recargarlo reinicia la duración, no se acumula |
| 4 | Ofrenda | Instantánea, GCD, todos los aliados a ≤ 30 m | 150 maná, CD 45 s | Cura 150 a cada uno |

### 5.3 Guerrero Águila — Daño (a distancia)
- **Vida:** 750. **Armadura:** 0.

| # | Habilidad | Tipo | Costo/CD | Efecto |
|---|---|---|---|---|
| 1 | Flecha de obsidiana | Casteo 2.0 s, GCD, 30 m | — | 140 de daño |
| 2 | Disparo veloz | Instantánea, GCD, 30 m | CD 6 s | 70 de daño |
| 3 | Grito de guerra | Instantánea, off-GCD, 30 m | CD 15 s | Interrumpe el casteo interrumpible del objetivo |
| 4 | Vuelo | Instantánea, off-GCD | CD 12 s | Desplaza 8 m en la dirección de movimiento (o hacia adelante si está quieto), sin salir de la arena |

---

## 6. El jefe: Mictlantecuhtli, Señor del Mictlán

- **Vida:** `12000 × número de jugadores`. **Armadura:** 0. **Radio de cuerpo:** 1.5 m.
- **Auto-ataque:** 60 de daño cada 2.0 s a su objetivo, si está a ≤ 4 m. Si no, camina hacia él a 5 m/s.
- **Enfurecer:** a los 480 s del inicio, todo su daño ×5.
- Los temporizadores de cada habilidad empiezan al entrar a la fase que la usa.

### Fase 1 — "Los nueve ríos" (100 % → 65 %)
| Habilidad | Cada | Detalle |
|---|---|---|
| Golpe del Descarnado | 20 s (primero a los 10 s) | Casteo 2.5 s **no interrumpible** sobre su objetivo: 400 de daño. El tanque debe usar Escudo |
| Viento de obsidiana | 15 s (primero a los 6 s) | Marca 3 círculos de 4 m bajo 3 jugadores al azar (o todos si hay menos). Aviso de 2.0 s, luego 200 de daño a quien siga dentro |
| Lamento de los muertos | 25 s (primero a los 14 s) | Casteo 3.0 s **interrumpible**: 250 de daño a todos los jugadores |

### Fase 2 — "Los guías" (65 % → 30 %)
- Se mantienen las tres habilidades de fase 1, pero Viento de obsidiana pasa a cada 12 s.
- **Llamado de los xolos:** al entrar en la fase y luego cada 40 s, invoca 2 **Xolos espectrales** en el borde de la arena.
  - Vida `600 × número de jugadores`, armadura 0, 25 de daño cada 1.5 s, velocidad 5 m/s.
  - Tabla de amenaza propia. Al aparecer dan 1 de amenaza al sanador, así que van por él hasta que el tanque los provoque o use Rugido.

### Fase 3 — "Río Apanohuaya" (30 % → 0 %)
- Al entrar, el radio de la arena se reduce de 20 m a 12 m durante 10 s.
- Estar fuera del radio actual: 100 de daño por segundo.
- Lamento de los muertos pasa a cada 18 s. Golpe del Descarnado se mantiene. Viento de obsidiana se desactiva.
- Los xolos vivos permanecen. No aparecen nuevos.

### Fin del encuentro
- **Victoria:** el jefe llega a 0 de vida.
- **Derrota:** todos los jugadores muertos.
- En ambos casos, 5 s después la sala vuelve al lobby con el estado reiniciado.

---

## 7. Arquitectura

```
mictlan/
├─ packages/core     # Motor de combate. TypeScript puro y determinista. Sin red, sin DOM, sin Date/Math.random
├─ apps/server       # Servidor Colyseus. Corre core a 20 Hz y sincroniza estado
└─ apps/client       # Vite + Phaser. Solo dibuja y manda entradas
```

- **Monorepo** con npm workspaces y TypeScript estricto. Tests con Vitest.
- **El servidor es la autoridad:** el cliente nunca decide daño, vida ni posiciones finales.
- **API central de core:**
  - `createEncounter(config, seed) → EncounterState`
  - `step(state, inputs, dtMs) → { state, events }` es pura, sin efectos.
  - Los `events` (daño, curación, inicio/fin de casteo, muerte, cambio de fase…) los usan el log de combate y el texto flotante.
- **Datos como datos:** clases, habilidades y jefe se definen como objetos de configuración en `packages/core/src/data/`, no como lógica dispersa.

### Mensajes cliente → servidor
| Mensaje | Payload |
|---|---|
| `move` | `{ dx, dy }` vector normalizado o (0,0) |
| `target` | `{ entityId }` |
| `cast` | `{ abilityId }` (usa el objetivo actual) |
| `ready` | `{ classId }` en el lobby |

### Estado sincronizado
Entidades (id, tipo, clase, x, y, vida, vida máx., recurso, objetivo, casteo actual con progreso, auras), zonas activas, fase, radio de la arena, tiempo de encuentro y estado de la sala (`lobby | combate | victoria | derrota`).

---

## 8. Interfaz (MVP)

- Marco propio (vida y recurso) y marco del objetivo, con su barra de casteo.
- Marcos de grupo (hasta 5), clicables.
- Barra de acción 1–4 con cooldown visible y estado "sin recurso" o "fuera de alcance".
- Barra de casteo propia y del jefe. Si el casteo es interrumpible, se marca con un borde distinto.
- Zonas de peligro como círculos rojos translúcidos que se llenan durante el aviso.
- Texto flotante de daño y curación. Log de combate en una esquina.
- Lobby: crear sala (código de 4 letras), unirse, elegir clase, "listo". La partida inicia cuando todos están listos y hay de 3 a 5 jugadores.

**Placeholders:** Jaguar = círculo naranja, Tícitl = verde, Águila = azul, Jefe = morado grande, Xolo = gris.

## 9. Dirección de arte (después del MVP)

Estética de códice y Día de Muertos: paleta de ocres, negro obsidiana y turquesa. **Todo el arte debe ser propio** o con licencia de uso libre (por ejemplo, CC0).
