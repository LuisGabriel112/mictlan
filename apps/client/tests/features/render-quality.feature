# language: es
Característica: Calidad gráfica y medidor de fps

  Escenario: Calidad alta por defecto
    Dado que la URL no trae parámetros de calidad
    Cuando se crea el mundo 3D
    Entonces hay bloom, sombras y el pixelRatio se limita a 1.5

  Escenario: Calidad baja para equipos lentos
    Dado que la URL trae "fx=low"
    Cuando se crea el mundo 3D
    Entonces no hay bloom ni sombras y el pixelRatio es 1

  Escenario: Medidor de fps
    Dado que la URL trae "fps=1"
    Cuando pasan cuadros
    Entonces se ve un letrero con los fps promedio y el peor cuadro en ms
