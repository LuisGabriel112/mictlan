# language: es
Característica: T3.5 Lobby jugable
  Escenario: Crear o unirse sin entrar automáticamente
    Dado el cliente sin dev=1 y con code=ABCD en la URL
    Cuando abre la página
    Entonces ve Crear sala y Unirse con ABCD rellenado
    Y no solicita una sala hasta pulsar un botón
    Cuando crea una sala o se une con cuatro letras
    Entonces usa create raid o joinById y muestra el código compartible

  Escenario: Recuperarse de un código inexistente
    Dado un código que el servidor no reconoce
    Cuando intenta unirse
    Entonces muestra La sala no existe. Revisa el código.
    Y permite corregir el código o crear una sala

  Esquema del escenario: Distinguir una sala inexistente de una sala bloqueada
    Dado que joinById rechaza la entrada con código <código> y mensaje <mensaje>
    Cuando el cliente muestra el error de conexión
    Entonces muestra <texto>
    Y permite corregir el código o crear una sala

    Ejemplos:
      | código | mensaje               | texto                                                      |
      | 522    | room "ABCD" not found | La sala no existe. Revisa el código.                        |
      | 522    | room "ABCD" is locked | La sala está llena o ya inició el combate.                  |
      | 521    | room "ABCD" is locked | No se pudo conectar al servidor. Inténtalo de nuevo.        |

  Escenario: Completar la composición
    Dado un lobby con un máximo de cinco jugadores
    Cuando el servidor actualiza los jugadores
    Entonces muestra sus clases y si están listos
    Y indica si falta Jaguar, Tícitl o al menos un Águila entre los listos
    Cuando el jugador elige clase y pulsa Listo
    Entonces envía ready con classId y espera la confirmación del servidor

  Escenario: Rechazar un segundo Jaguar
    Dado un Jaguar listo y otro jugador que elige Jaguar
    Cuando el servidor responde rejected con composition
    Entonces muestra Ese rol ya está ocupado
    Y permite elegir otra clase
    Cuando recibe invalid_class
    Entonces muestra Clase inválida

  Esquema del escenario: Completar un intento y volver a prepararse
    Dado tres jugadores listos con Jaguar, Tícitl y Águila
    Cuando el servidor pasa a combat
    Entonces se ve la escena de combate y se habilitan sus controles
    Cuando el servidor pasa a <estado> con elapsedTicks
    Entonces se ve <título> y la duración mm:ss desde el pull
    Y los controles de combate quedan inactivos
    Cuando el servidor vuelve a lobby cinco segundos después
    Entonces se conserva la clase y Listo queda desmarcado
    Y la lectura de combate se limpia para el siguiente intento

    Ejemplos:
      | estado  | título      |
      | victory | ¡Victoria!  |
      | defeat  | Derrota     |

  Escenario: Mantener el acceso de desarrollo
    Dado dev=1 y class=healer
    Cuando abre la página
    Entonces usa joinOrCreate raid y envía ready con healer
    Y se salta inicio y lobby incluso al volver del resultado

  Escenario: Ignorar el estado vacío antes de la primera sincronización
    Dado una sala recién creada cuyo estado todavía no tiene jugadores ni entidades
    Cuando el lobby o la arena leen ese estado
    Entonces no fallan y esperan al primer estado completo
    Y al llegar el estado completo muestran la pantalla que corresponde
