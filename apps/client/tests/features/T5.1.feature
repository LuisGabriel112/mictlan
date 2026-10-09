Feature: T5.1 Escena 3D y entrada
  Scenario: Cámara isométrica que encuadra la arena
    Given una ventana de cualquier tamaño (ancha, alta o cuadrada)
    When se arma la cámara ortográfica fija desde el sureste a 35° de elevación
    Then el círculo de la arena con 2 m de margen cabe completo en pantalla
    And el centro de la arena queda en el centro de la pantalla

  Scenario: Del clic al suelo y del suelo a la pantalla
    Given la cámara isométrica
    When el jugador hace clic en un píxel de la pantalla
    Then el punto del suelo bajo ese píxel se obtiene en metros del core (x este, y norte)
    And proyectar ese punto de vuelta da el mismo píxel

  Scenario: El mundo se dibuja en Three.js
    Given un snapshot con jugadores, jefe, xolos, zonas y fase 3
    When se dibuja un cuadro
    Then cada unidad es una forma del color de su clase, en su posición interpolada
    And los muertos se ven al 30 % de opacidad
    And hay aro blanco bajo el propio jugador y aro amarillo bajo el objetivo
    And cada Viento es un disco rojo con su borde animado y la fase 3 muestra la franja insegura
    And el jefe golpeado brilla y crece según el destello de T4.6
    And las unidades que desaparecen del snapshot se quitan y liberan

  Scenario: Phaser queda solo como HUD encima
    Given la escena de combate
    When llegan estados, eventos, teclas y clics
    Then el clic izquierdo selecciona con el punto del suelo, el derecho camina allí
    And Tab, F1–F5, Q W E R y S funcionan igual que antes
    And los números flotantes y las barras de vida sobre las unidades usan la proyección 3D
    And al salir de la escena se liberan los recursos de Three.js
