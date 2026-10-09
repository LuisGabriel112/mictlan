Feature: T6.2 Esquiva para todos
  Scenario: Esquivar con Espacio
    Given cualquier clase en combate
    When pulsa Espacio
    Then se desplaza 4 m hacia donde camina o mira, sin costo y sin GCD
    And la Esquiva entra en recarga de 8 s, visible en el quinto espacio "Espacio · Esquiva" junto a la barra
    And la página no hace scroll

  Scenario: Esquiva cancela el casteo propio
    Given el jugador casteando
    When esquiva
    Then el casteo se cancela con motivo "Esquiva" (aparece así en el resumen del intento)
    And no consume recurso ni recarga de esa habilidad

  Scenario: Límites
    Then la Esquiva se recorta en el muro de la arena
    And en recarga o muerto se rechaza
    And Vuelo del Águila sigue igual (8 m, 12 s)
