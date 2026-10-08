# language: es
Característica: T3.4 Lectura del combate
  Escenario: Identificar el golpe letal
    Dado un evento de muerte con origen y habilidad del golpe letal
    Cuando el cliente genera el log en español
    Entonces la línea dice quién murió, quién lo mató y la habilidad usada

  Escenario: Leer los eventos del encuentro
    Dado daño, curación, cambio de fase, enfurecer, fin e inicio de casteo del jefe
    Cuando el cliente recibe los eventos
    Entonces conserva las últimas 12 líneas en orden con nombres de core
    Y no duplica los rechazos mostrados como aviso

  Escenario: Texto flotante legible
    Dado daño o curación efectiva sobre una entidad visible
    Cuando se agrega a la cola
    Entonces usa su posición y el color y tamaño de su estilo
    Cuando transcurre medio segundo
    Entonces sube y pierde opacidad sin mutar la cola anterior
    Cuando transcurre un segundo
    Entonces desaparece
    Y no se dibuja sobre los marcos, las barras ni el log

  Escenario: Reconocer los peligros
    Dado fase 3 con radio seguro reducido y círculos de Viento en aviso
    Cuando se dibuja la arena
    Entonces solo el exterior del radio seguro queda sombreado en rojo
    Y el contorno del Viento pulsa durante el aviso

  Escenario: Medir el tiempo desde el pull
    Dado elapsedTicks y la fase sincronizados por el servidor
    Cuando se dibuja el encabezado
    Entonces muestra mm:ss y el número y nombre de fase de core
    Y se reinicia la lectura cuando vuelve al lobby
