Feature: T4.4 Resumen del intento
  Scenario: Medir la contribución de cada jugador
    Given un intento con daño, sobrecuración y curación efectiva de varios jugadores
    When termina con 200 ticks transcurridos desde el pull
    Then cada jugador ve sus totales y sus DPS y HPS calculados sobre 10 segundos
    And un intento sin tiempo transcurrido muestra tasas de cero

  Scenario: Explicar acciones perdidas y muertes
    Given casteos cancelados y habilidades rechazadas por distintos motivos
    And golpes del jefe, de un xolo y del entorno
    When el grupo pierde
    Then se cuentan las cancelaciones y rechazos por motivo
    And los golpes del jefe se agrupan por habilidad con cantidad y daño total
    And cada muerte muestra la habilidad y el autor del evento death

  Scenario: Recibir eventos antes del estado sincronizado
    Given eventos recibidos antes del primer estado o de la transición a combat
    When llegan estados incompletos y después un estado sincronizado
    Then el cliente no falla ni pierde esos eventos
    And los últimos eventos recibidos después del estado de resultado actualizan la tabla

  Scenario: Separar intentos
    Given un resultado con estadísticas acumuladas
    When se reciben más snapshots del resultado
    Then el resumen se conserva incluyendo jugadores desconectados
    When el servidor vuelve al lobby y empieza otro combate
    Then el nuevo intento contiene solo sus propios eventos

  Scenario: Leer el resultado en HTML
    Given una victoria o derrota con varios jugadores
    When se muestra el resultado debajo del título y la duración
    Then cada jugador tiene una fila con todas las estadísticas y nombres en español
    And el jugador propio está resaltado
    And la tabla permite desplazamiento horizontal en pantallas angostas
    And debajo aparece "Referencia de bots perfectos (3 jugadores): Jaguar 25 DPS · Águila 58 DPS · Tícitl 27 HPS"
