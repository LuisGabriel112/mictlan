Feature: T5.3 Ambiente estilo V Rising
  Scenario: Noche fría con niebla y viñeta
    Given la arena en combate
    When se dibuja
    Then el fondo es casi negro, hay niebla azul oscuro que se espesa al fondo
    And la luz principal es una luna fría que proyecta sombras de las unidades
    And los bordes de la pantalla se oscurecen (viñeta)

  Scenario: Braseros de color en el muro
    Given el muro de la arena
    Then hay pilares de piedra repartidos en el borde
    And sobre algunos pilares arden braseros turquesa y morados que iluminan el piso
    And su luz parpadea suave con el tiempo sin crear objetos por cuadro

  Scenario: El jefe ilumina su entorno
    Given el jefe vivo
    Then una luz morada lo sigue
    And se intensifica mientras castea

  Scenario: Piso de piedra
    Given el piso de la arena
    Then está hecho de losas concéntricas con tonos de piedra que varían de forma determinista

  Scenario: Ceniza y brillo
    Given el combate
    Then flotan partículas de ceniza que suben y reaparecen abajo al salir
    And lo brillante (zonas rojas, proyectiles, casteos, braseros) tiene bloom
