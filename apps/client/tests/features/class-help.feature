Feature: T4.3 Habilidades y roles legibles
  Scenario Outline: Leer la clase antes de marcar Listo
    Given el lobby con la clase <class> elegida
    When leo el panel de clase
    Then veo su rol, vida, recurso y cuatro habilidades en orden Q W E R
    And cada habilidad muestra nombre, tipo, descripción, costo, casteo, recarga y alcance desde core
    Examples:
      | class  |
      | jaguar |
      | healer |
      | eagle  |

  Scenario: Consultar la guía elegida
    Given una clase elegida en el lobby
    When pulso Cómo jugar
    Then leo exactamente su guía de SPEC 5.4 y los controles comunes
    And puedo cerrar con el botón Cerrar, Esc o H

  Scenario: Consultar habilidades durante combate
    Given el combate con cuatro botones de habilidad
    When paso el puntero o enfoco un botón de ayuda
    Then veo su tipo y el mismo contenido que en el panel
    And el tooltip está sobre ese botón incluso después de redimensionar
    When retiro el puntero o el foco
    Then el tooltip se oculta

  Scenario: Abrir ayuda sin activar acciones de combate
    Given el combate activo
    When pulso H
    Then se abre la guía de mi clase sin enviar entradas de combate
    And las teclas del juego no actúan mientras leo la guía
    When pulso Esc o H sin repetición
    Then la guía se cierra y recupero el foco

  Scenario: Cambiar de pantalla y de clase
    Given ayuda abierta durante combate
    When termina el combate y regreso al lobby
    Then desaparecen la guía y los tooltips de combate
    When elijo otra clase
    Then el panel y la próxima guía corresponden a la nueva clase
