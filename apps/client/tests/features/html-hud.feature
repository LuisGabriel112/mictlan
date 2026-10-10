Feature: T5.2 HUD en HTML sin Phaser
  Scenario: Información del intento
    Given un combate sincronizado con cinco jugadores, jefe y xolos
    When llega un estado con vida, maná, casteos y recargas
    Then aparecen marcos propio, objetivo y grupo, tres barras de casteo y cinco espacios de acción
    And el borde turquesa distingue el casteo interrumpible
    And se conservan tiempo, fase, estado, avisos y detalles de habilidades en español

  Scenario: Lectura proyectada y reutilización del DOM
    Given eventos de daño, crítico, curación y muerte
    When se dibuja el mundo con ArenaWorld.project
    Then el log conserva su orden y los números flotantes envejecen y desaparecen
    And los números que intersectan el HUD se ocultan
    And las unidades vivas tienen barras compactas con marco oscuro sobre la cabeza
    And repetir valores no escribe en el DOM ni crea nodos durante el cuadro

  Scenario: Controles del raid ágil
    Given un estado de combate y eventos de navegador falsos
    When se usan WASD, 1 a 4, Espacio, X, Tab, F1 a F5 o Shift y números
    Then se envían los mismos mensajes de movimiento, habilidades y selección
    And Tab, Espacio y F1 a F5 impiden la acción del navegador
    And soltar teclas o perder foco detiene el movimiento
    And clic izquierdo prioriza marcos de grupo y luego cuerpos proyectados
    And clic derecho usa ArenaWorld.pick y no abre el menú contextual

  Scenario: Inicio, resultado y nuevo intento
    Given eventos anteriores al primer estado o un estado incompleto
    When llega el combate, termina y regresa al lobby
    Then las entradas solo actúan durante combate
    And el bucle usa un reloj inyectado para interpolación, destellos y efectos
    And al volver al lobby se cancelan cuadros, se libera el mundo y se limpia la lectura
    And el siguiente intento crea un mundo nuevo sin duplicar escuchas

  Scenario: Ayuda y redimensionamiento
    Given la ayuda HTML de T4.3 y el tutorial existentes
    When cambia el tamaño de la ventana
    Then el HUD y los tooltips comparten actionSlotRects
    And la cámara se reencuadra y las entradas usan coordenadas del contenedor
