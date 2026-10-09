Feature: T5.1b Lectura del combate en 3D
  Scenario: Los ataques a distancia viajan
    Given un Águila a 15 m del jefe
    When llega un evento damage de Flecha de obsidiana del Águila al jefe
    Then un proyectil del color del Águila sale del Águila y llega al jefe en 250 ms
    And una cura a distancia del Tícitl viaja en verde y estalla en el aliado curado

  Scenario: Los golpes cuerpo a cuerpo se ven como un tajo
    Given el Jaguar o el jefe a distancia cuerpo a cuerpo de su objetivo
    When llega un evento damage de Zarpazo o de auto-ataque
    Then aparece un arco de golpe frente al atacante, orientado hacia el objetivo, que se desvanece en 200 ms

  Scenario: Los daños de zona no disparan proyectiles
    Given eventos de Viento de obsidiana, del entorno o ticks de Copal
    When se procesan
    Then no hay proyectil ni tajo; el Copal solo deja el destello verde en el aliado

  Scenario: Los casteos se leen en el suelo
    Given una unidad casteando
    When se dibuja el cuadro
    Then hay un anillo bajo ella que se llena con el progreso del casteo
    And es turquesa si se puede interrumpir y rojo si no
    And la unidad se inclina hacia su objetivo mientras castea

  Scenario: Los efectos no se acumulan
    Given efectos que ya terminaron
    When pasa su duración
    Then se quitan de la escena sin crear objetos nuevos por cuadro
