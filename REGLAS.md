# Reglas del Dominó múltiplo de 5

## Carácter normativo

Este archivo es la **fuente normativa principal** de las reglas del juego. El código, los tests, los prototipos y el renderer deben implementar lo aquí establecido, pero no pueden crear ni modificar reglas indirectamente.

Cuando una regla no esté acordada se marca exactamente como **PENDIENTE DE DEFINICIÓN**. Una ausencia de definición no autoriza a adoptar una convención de otras variantes de dominó.

## Terminología

- **Ficha:** pieza física con dos lados y un valor entre 0 y 6 en cada lado.
- **Valor de una ficha:** suma de los valores de sus dos lados cuando se calculan fichas restantes.
- **Chancho o doble N:** ficha cuyos dos lados muestran el mismo valor `N`.
- **Extremo abierto:** extremo lógico del tablero disponible según las reglas de conexión. Su posición visual no forma parte de la regla.
- **Línea principal:** recorrido lógico principal del tablero. La expresión física “línea horizontal principal” no obliga al motor a usar horizontalidad, izquierda, derecha ni coordenadas.
- **Ramificación:** parte conectada del tablero que no pertenece a la línea principal.
- **K:** entero no negativo fijado antes de comenzar la ronda que limita cuántos de los primeros chanchos colocados en la línea principal pueden recibir hasta cuatro conexiones.
- **Puntos durante el juego:** puntos concedidos después de cada jugada por la suma de extremos abiertos.
- **Vencedor tradicional:** equipo que obtiene el vencimiento por salida de un jugador o por menor suma en un juego trancado. Este estado determina si existe bonificación final.

## Chanchos especiales y parámetro K

### R-001 — Primeros K chanchos especiales

En una partida con parámetro `K`, los primeros `K` chanchos que sean colocados sobre la línea principal podrán recibir hasta cuatro conexiones. Todos los demás chanchos se comportarán como piezas ordinarias.

### R-002 — Restricción a la línea principal

Los chanchos habilitados para cuatro conexiones solo podrán desempeñar esa función cuando sean colocados sobre la línea principal de la partida. Un chancho colocado en una ramificación se comportará como un chancho ordinario, podrá conectarse únicamente por sus dos lados tradicionales y no consumirá uno de los `K` cupos.

### R-019 — Conexiones tercera y cuarta

Un chancho especial puede seguir recibiendo una tercera y una cuarta conexión aunque, desde la segunda conexión, ya no aporte a la suma de extremos abiertos.

### R-027 — Dominio de K

`K` se fija antes de comenzar la ronda y pertenece a los enteros no negativos. `K = 0` está permitido.

#### Consecuencia matemática, no regla adicional

El dominó doble-seis contiene exactamente siete chanchos: `0–0`, `1–1`, `2–2`, `3–3`, `4–4`, `5–5` y `6–6`. Por ello, para cualquier `K > 7`, el efecto posible es el mismo que para `K = 7`: no pueden existir más de siete chanchos candidatos en todo el juego.

El valor reglamentario configurado debe conservarse. Una implementación puede derivar `effectiveK = min(K, 7)` para cálculos internos, pero no debe rechazar ni reemplazar un `K > 7` alegando una regla inexistente.

## Participantes, material y reparto

### R-003 — Participantes y equipos

Juegan cuatro personas formando dos equipos de dos integrantes.

### R-004 — Ubicación alternada de compañeros

Los compañeros de equipo se ubican alternadamente.

### R-005 — Conjunto de fichas

Se utiliza un dominó doble-seis de 28 fichas. Cada ficha corresponde a una combinación no ordenada de dos valores entre 0 y 6, incluidos ambos extremos.

### R-006 — Reparto completo

Cada jugador recibe exactamente siete fichas. No existe pozo y no quedan fichas sin repartir.

## Inicio, turnos y pase

### R-007 — Jugador inicial

Comienza el jugador que posee el chancho `6–6`.

### R-008 — Primera ficha libre dentro de la mano

El jugador inicial no está obligado a jugar el `6–6`; puede comenzar con cualquiera de sus fichas.

### R-009 — Sentido de los turnos

Los turnos avanzan en sentido antihorario.

### R-010 — Acción de un turno con jugada legal

En cada turno se juega exactamente una ficha compatible con algún extremo disponible.

### R-011 — Pase obligatorio

Si un jugador no dispone de ninguna jugada legal, pasa.

### R-012 — Juego trancado

Cuatro pases consecutivos constituyen juego trancado.

### R-013 — Terminación del juego

La partida termina cuando un jugador coloca su última ficha o cuando el juego queda trancado.

## Puntuación durante el juego

### R-014 — Momento de cálculo

Después de cada jugada se calcula la suma `S` de los extremos abiertos.

### R-015 — Puntuación por múltiplo de 5

Si `S = 5m`, el equipo del jugador obtiene `m = S / 5` puntos.

### R-016 — Jugada sin puntuación

Si `S` no es múltiplo de 5, la jugada entrega 0 puntos.

### R-017 — Puntuación de la última jugada

La última jugada también puede entregar puntuación conforme a R-014, R-015 y R-016.

### R-018 — Aporte de un chancho a S

Un chancho `N` con cero o una conexión aporta `2N` a la suma `S`. Desde la segunda conexión, ese chancho aporta 0.

Esta regla de aporte es independiente de que un chancho especial todavía pueda aceptar una tercera o cuarta conexión conforme a R-019.

## Vencimiento y puntuación final

### R-020 — Vencimiento por salida

Si un jugador coloca su última ficha, su equipo obtiene el vencimiento tradicional.

### R-021 — Vencimiento en juego trancado

En un juego trancado se suman los valores de las fichas restantes de cada equipo. Obtiene el vencimiento tradicional el equipo con menor suma.

### R-022 — Igualdad en el tranque

Si las sumas de ambos equipos coinciden en un juego trancado, no existe vencedor tradicional y ningún equipo recibe bonificación final.

### R-023 — Bonificación del vencedor tradicional

Si existe vencedor tradicional, sea `a` la suma de los valores de las fichas restantes del equipo rival. La bonificación del vencedor tradicional es el entero más cercano a `a / 5`.

Equivalentemente, si `a = 5q + r`:

- la bonificación es `q` cuando `r = 0, 1, 2`;
- la bonificación es `q + 1` cuando `r = 3, 4`.

### R-024 — Puntaje final

El puntaje final de cada equipo es la suma de sus puntos obtenidos durante el juego y su bonificación final.

### R-025 — Equipo ganador

Gana el equipo con mayor puntaje final.

### R-026 — Empate final

Si ambos puntajes finales coinciden, la partida termina empatada.

## Compatibilidad, elección y reparto

### R-028 — Compatibilidad por igualdad

Dos lados son compatibles si y solo si muestran el mismo valor. Si un extremo abierto presenta el valor `n`, únicamente puede conectarse a un lado o puerto cuyo valor también sea `n`.

Esta regla se aplica en la línea principal y en las ramificaciones. Los chanchos no constituyen una excepción.

Ejemplos:

- extremo 5 con lado 5: compatible;
- extremo 5 con lado 3: incompatible;
- extremo 0 con lado 0: compatible.

### R-029 — Mezcla aleatoria y reparto

Antes de comenzar cada partida, las 28 fichas se mezclan aleatoriamente y se distribuyen de modo que cada jugador reciba exactamente siete fichas.

La regla exige que la distribución resulte de una mezcla aleatoria. El algoritmo informático que produce la permutación no forma parte del reglamento. En particular, el reglamento no exige Fisher–Yates ni ningún otro algoritmo específico.

### R-030 — Libertad de elección entre jugadas legales

Si un jugador dispone de más de una jugada legal, puede escoger libremente qué ficha legal jugar y en cuál extremo abierto legal colocarla.

El motor debe enumerar todas las jugadas legales. La elección corresponde al jugador y no se selecciona automáticamente una jugada cuando existen varias posibilidades. La orientación gráfica posterior pertenece al renderer.

## Topología lógica del tablero

### R-031 — Línea principal

La primera ficha jugada pertenece a la línea principal. La línea principal es un camino simple del grafo y continúa exclusivamente mediante sus dos extremos principales.

Una jugada sobre uno de esos extremos extiende la línea principal y agrega la nueva colocación a uno de los extremos de su recorrido lógico. `mainLine.placementIds` conserva el orden de ese recorrido desde un extremo principal hasta el otro.

Para una línea con varias colocaciones, cada par consecutivo del array está conectado dentro del recorrido principal. El primer y el último elemento contienen los dos extremos principales actuales. Con una única colocación, sus dos puertos tradicionales o principales son ambos extremos del recorrido.

La expresión física “línea horizontal principal” no introduce geometría en el motor. Horizontalidad, izquierda y derecha pertenecen exclusivamente al renderer.

### R-032 — Puertos de un chancho especial

Un chancho especial `N|N` situado en la línea principal dispone de cuatro puertos lógicos:

- `main:1` y `main:2`, asociados a la continuidad de la línea principal;
- `branch:1` y `branch:2`, capaces de iniciar hasta dos ramificaciones.

Cada uno de los cuatro puertos presenta el valor `N` a efectos de R-028. Cada puerto admite como máximo una conexión.

Un chancho ordinario solo dispone de sus dos puertos tradicionales. Los nombres de puertos no representan direcciones gráficas.

### R-033 — Capacidad de conexión y aporte a S

Cuando un chancho especial se incorpora a la línea principal, participa en ella mediante sus puertos `main:1` y `main:2`. Sus puertos `branch:1` y `branch:2` son los únicos que pueden originar ramificaciones.

El ordinal de una conexión indica cuántas conexiones tiene actualmente el chancho; no identifica una dirección gráfica ni un puerto determinado. La capacidad de recibir conexiones y la contribución a `S` son propiedades distintas:

- con 0 o 1 conexión, un chancho `N` aporta `2N` a `S`;
- con 2, 3 o 4 conexiones, aporta 0;
- solo un chancho especial puede alcanzar 3 o 4 conexiones.

Esta regla aclara conjuntamente R-018 y R-019 sin alterar su significado.

### R-034 — Ramificación

Una ramificación puede comenzar únicamente mediante una conexión desde `branch:1` o `branch:2` de un chancho especial situado en la línea principal.

Después de su primera ficha, la ramificación continúa como una cadena ordinaria de dominó desde su único extremo terminal disponible. Toda ficha de esa cadena queda fuera de `mainLine`.

Una nueva colocación extiende la línea principal si se conecta a uno de sus dos extremos principales. Pertenece a una ramificación si inicia una cadena desde un puerto `branch:*` especial o extiende el extremo terminal de una cadena lateral existente.

Diagrama puramente ilustrativo, sin significado geométrico para el motor:

```text
[principal]—main:1 [N|N] main:2—[principal]
                         |
                      branch:1
                         |
                       [N|a]—[a|b]
```

### R-035 — Prohibición de ramificaciones de segundo nivel

Una ramificación no puede originar nuevas ramificaciones.

Un chancho colocado dentro de una ramificación funciona como ordinario: solo dispone de sus dos lados tradicionales, no adquiere puertos adicionales, no consume uno de los K cupos y no puede iniciar una rama secundaria.

Todas las ramificaciones se originan directamente en un chancho especial de la línea principal. La topología resultante es un camino principal con cadenas laterales, no un árbol arbitrariamente ramificado.

## Casos normativos mínimos

### Caso A — Primera ficha

Se juega una única ficha `2|5`. Su colocación es el único elemento de `mainLine.placementIds`; sus extremos de valor 2 y 5 son los dos extremos principales.

### Caso B — Extensión ordinaria

Sobre el extremo 5 del caso A se coloca `5|3`. Es compatible por R-028 y su colocación se añade al extremo correspondiente de `mainLine.placementIds`. Los extremos principales pasan a presentar 2 y 3.

### Caso C — Chancho especial

Con `K ≥ 1`, el primer chancho colocado en la línea principal adquiere condición especial, se registra en `specialDoublePlacementIds` y dispone de `main:1`, `main:2`, `branch:1` y `branch:2`.

### Caso D — Primera ramificación

Desde `branch:1` de un chancho especial `4|4` se conecta una ficha `4|2`. Esa nueva colocación no entra en `mainLine.placementIds` e inicia una cadena lateral.

### Caso E — Chancho dentro de rama

Al extremo 2 de la cadena anterior se conecta `2|2`. Ese chancho es ordinario, solo tiene dos lados tradicionales, no entra en `specialDoublePlacementIds` y no puede generar otra rama.

### Caso F — K=0

Con `K = 0`, `specialDoublePlacementIds` permanece vacío. Ningún chancho puede usar puertos `branch:*` ni iniciar ramificaciones.

### Caso G — K agotado

Con `K = 1`, el primer chancho de la línea principal adquiere condición especial. Un chancho principal posterior funciona como ordinario y no se añade a `specialDoublePlacementIds`.

### Caso H — Puntuación del chancho

Para un mismo chancho `N`: con una conexión aporta `2N`; con dos, tres o cuatro conexiones aporta 0. Las conexiones tercera y cuarta solo son posibles si la colocación es especial.

## Pendientes no bloqueantes para el juego actual

No quedan vacíos normativos que bloqueen el motor básico de la partida actualmente definida. Permanecen fuera de su alcance:

- una mecánica de deshacer, si en el futuro se autoriza;
- una serie compuesta por varias partidas o una meta acumulada, si se incorpora otra modalidad.

## Fuera de las reglas de juego actuales

Los nombres de jugadores, la presentación visual de los asientos, el ocultamiento local de manos, la persistencia, el replay y el protocolo multijugador son decisiones de producto o arquitectura. Deben documentarse en sus ámbitos y no convertirse en reglas por omisión.

## Proceso para incorporar reglas futuras

1. Asignar un identificador estable `R-nnn` sin reutilizar IDs anteriores.
2. Definir términos, precondiciones, resultado y casos límite.
3. Añadir ejemplos con resultados esperados inequívocos.
4. Revisar su impacto en tablero, estado e invariantes.
5. Solo entonces implementar y probar la regla.
