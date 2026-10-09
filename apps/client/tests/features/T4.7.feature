Feature: T4.7 Tutorial in-game
  Scenario: Guiar a un jugador nuevo en su primer intento
    Given un navegador que nunca completó ni saltó el tutorial
    When empieza el combate
    Then se muestra "Paso 1/4" con la instrucción de seleccionar al jefe
    And el panel no aparece en el lobby ni en la pantalla de resultado

  Scenario: Avanzar al detectar cada acción
    Given el tutorial en el paso 1
    When el jugador selecciona al jefe
    Then pasa al paso 2 (caminar con clic derecho)
    When camina al menos 1 m desde donde empezó el paso
    Then pasa al paso 3 con el nombre de la habilidad Q de su clase
    When lanza una habilidad (GCD activo o casteo en curso)
    Then pasa al paso 4 (salir de un círculo rojo)
    When entra a una zona de Viento de obsidiana y sale vivo
    Then el tutorial termina, se oculta y queda guardado como completado

  Scenario: Morir dentro de la zona no completa el paso 4
    Given el tutorial en el paso 4 con el jugador dentro de una zona
    When el jugador muere
    Then el paso 4 sigue pendiente aunque su cuerpo quede fuera de la zona

  Scenario: Saltar y repetir
    Given el tutorial visible
    When el jugador pulsa "Saltar"
    Then el panel se oculta y no vuelve a aparecer en el siguiente intento
    When el jugador pulsa T
    Then el tutorial empieza de nuevo en el paso 1

  Scenario: Navegador sin almacenamiento
    Given localStorage lanza error o no existe
    When se consulta o guarda el progreso
    Then el juego no falla y el tutorial se muestra
