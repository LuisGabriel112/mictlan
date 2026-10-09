Feature: T6.1 WASD y habilidades en 1 2 3 4
  Scenario: Caminar con WASD relativo a la cámara
    Given la cámara isométrica fija desde el sureste
    When el jugador mantiene W
    Then camina hacia arriba de la pantalla (noroeste del mundo)
    And A, S y D caminan a la izquierda, abajo y derecha de la pantalla
    And dos teclas a la vez caminan en diagonal con la misma velocidad

  Scenario: Solo se avisa al servidor cuando cambia la dirección
    Given el jugador mantiene W
    When el navegador repite la tecla
    Then no se envía otro move
    When suelta todas las teclas
    Then se envía move con dirección cero y se detiene
    And si teclas opuestas se anulan, también se detiene

  Scenario: WASD y clic derecho conviven
    Given el jugador caminaba con clic derecho hacia un destino
    When pulsa una tecla WASD
    Then el destino y su marcador desaparecen y manda WASD

  Scenario: Perder el foco no deja al jugador caminando
    Given el jugador mantiene D
    When la ventana pierde el foco
    Then se envía move con dirección cero

  Scenario: Habilidades en 1 2 3 4 y X detiene
    When el jugador pulsa 1, 2, 3 o 4 (fila superior o teclado numérico)
    Then lanza la habilidad de ese espacio de la barra
    And Shift + 1–5 sigue seleccionando aliados
    And X detiene el movimiento; S ya no detiene
