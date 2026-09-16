# Reglas del Dominó múltiplo de 5

## Carácter normativo

Este archivo es la **fuente normativa principal** de las reglas del juego. El código, los tests, los prototipos y el renderer deben implementar lo aquí establecido, pero no pueden crear ni modificar reglas indirectamente.

Cuando una regla no esté acordada se marca exactamente como **PENDIENTE DE DEFINICIÓN**. Una ausencia de definición no autoriza a adoptar una convención de otras variantes de dominó.

## Terminología

- **Ficha:** pieza física con dos lados y un valor entre 0 y 6 en cada lado.
- **Valor de una ficha:** suma de los valores de sus dos lados cuando se calculan fichas restantes.
- **Chancho o doble N:** ficha cuyos dos lados muestran el mismo valor `N`.
- **Extremo abierto:** extremo lógico del tablero disponible según las reglas de conexión. Su posición visual no forma parte de la regla.
- **Modo Ramificado:** modo en el que el primer chancho colocado es el único chancho ramificador de la ronda.
- **Modo Lineal:** modo en el que todos los chanchos son ordinarios y el tablero forma una única cadena.
- **Chancho ramificador:** primer chancho efectivamente colocado en una ronda Ramificada; puede recibir hasta cuatro conexiones.
- **Brazo:** cadena acíclica que parte del chancho ramificador. Sus brazos son reglamentariamente equivalentes.
- **Puntos durante el juego:** puntos concedidos después de cada jugada por la suma de extremos abiertos.
- **Vencedor tradicional:** equipo que obtiene el vencimiento por salida de un jugador o por menor suma en un juego trancado. Este estado determina si existe bonificación final.

## Modos estructurales y chanchos

### R-001 — Único chancho ramificador

En modo **Ramificado**, el primer chancho efectivamente colocado en la ronda es el único chancho ramificador y puede recibir hasta cuatro conexiones. Si la apertura es `6|6`, ese chancho es el ramificador; si la apertura no es doble, adquiere esa condición el primer doble que se coloque posteriormente.

### R-002 — Chanchos posteriores ordinarios

Todos los chanchos colocados después del primero son ordinarios y admiten como máximo dos conexiones, con independencia del brazo o cadena donde se coloquen. Solo puede existir un chancho ramificador por ronda.

### R-019 — Conexiones tercera y cuarta

El chancho ramificador puede seguir recibiendo una tercera y una cuarta conexión aunque, desde la segunda conexión, ya no aporte a la suma de extremos abiertos.

### R-027 — Modos estructurales

Antes de comenzar la ronda se elige exactamente uno de estos modos:

- **Ramificado:** se aplica R-001 y existe como máximo un chancho con capacidad cuatro.
- **Lineal:** todos los chanchos son ordinarios, admiten como máximo dos conexiones y el tablero se mantiene como una única cadena.

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

Esta regla de aporte es independiente de que el chancho ramificador todavía pueda aceptar una tercera o cuarta conexión conforme a R-019.

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

Esta regla se aplica en cualquier brazo o cadena. Los chanchos no constituyen una excepción.

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

### R-031 — Cadena inicial y brazos equivalentes

Antes de existir un chancho ramificador, el tablero es una cadena simple con dos extremos. En modo Lineal conserva esa forma durante toda la ronda.

En modo Ramificado, el primer chancho colocado puede reunir hasta cuatro cadenas acíclicas. Esas cadenas son brazos equivalentes: ninguna posee prioridad o jerarquía reglamentaria sobre las demás.

El campo interno `mainLine.placementIds` puede conservar un camino ordenado para compatibilidad del modelo, pero esa clasificación no concede capacidades especiales ni define categorías visibles para el jugador.

### R-032 — Puertos del chancho ramificador

El chancho ramificador `N|N` dispone de cuatro puertos lógicos, cada uno con valor `N` y capacidad para una sola conexión.

- `main:1`, `main:2`, `branch:1` y `branch:2` son identificadores internos canónicos mantenidos por compatibilidad.

Los cuatro puertos son reglamentariamente equivalentes; sus nombres no representan jerarquía, dirección gráfica ni prioridad. Un chancho ordinario solo dispone de sus dos puertos tradicionales.

### R-033 — Capacidad de conexión y aporte a S

El ordinal de una conexión indica cuántas conexiones tiene actualmente el chancho; no identifica una dirección gráfica ni un puerto determinado. La capacidad de recibir conexiones y la contribución a `S` son propiedades distintas:

- con 0 o 1 conexión, un chancho `N` aporta `2N` a `S`;
- con 2, 3 o 4 conexiones, aporta 0;
- solo el chancho ramificador puede alcanzar 3 o 4 conexiones.

Esta regla aclara conjuntamente R-018 y R-019 sin alterar su significado.

### R-034 — Extensión de brazos

Cada conexión libre del chancho ramificador puede iniciar o continuar un brazo. Después de la ficha adyacente al chancho, ese brazo continúa como una cadena ordinaria desde su único extremo terminal disponible.

La representación interna puede distinguir dos continuidades heredadas como `main:*` y dos laterales como `branch:*`, pero las cuatro cadenas resultantes son equivalentes para las decisiones reglamentarias del jugador.

Diagrama puramente ilustrativo, sin significado geométrico para el motor:

```text
[brazo]—puerto [N|N] puerto—[brazo]
                   |
                 puerto
                   |
               [N|a]—[a|b]
```

### R-035 — Aciclicidad y ausencia de ramificación secundaria

Ningún brazo puede originar una ramificación secundaria. Un chancho posterior funciona como ordinario y no adquiere puertos adicionales.

Los brazos no pueden reconectarse entre sí ni regresar a una cadena ya existente. La topología permanece acíclica y todas las bifurcaciones, si existen, se concentran en el único chancho ramificador.

## Casos normativos mínimos

### Caso A — Primera ficha

Se juega una única ficha `2|5`. Su colocación es el único elemento de `mainLine.placementIds`; sus extremos de valor 2 y 5 son los dos extremos principales.

### Caso B — Extensión ordinaria

Sobre el extremo 5 del caso A se coloca `5|3`. Es compatible por R-028 y su colocación se añade al extremo correspondiente de `mainLine.placementIds`. Los extremos principales pasan a presentar 2 y 3.

### Caso C — Primer chancho en modo Ramificado

El primer chancho colocado adquiere condición ramificadora, se registra internamente en `specialDoublePlacementIds` y dispone de cuatro puertos.

### Caso D — Nuevo brazo

Desde un puerto libre del chancho ramificador `4|4` se conecta una ficha `4|2`. Esa colocación inicia uno de sus brazos; el identificador interno concreto del puerto no altera su jerarquía reglamentaria.

### Caso E — Chancho dentro de rama

Al extremo 2 de la cadena anterior se conecta `2|2`. Ese chancho es ordinario, solo tiene dos lados tradicionales, no entra en `specialDoublePlacementIds` y no puede generar otra rama.

### Caso F — Modo Lineal

`specialDoublePlacementIds` permanece vacío. Ningún chancho puede usar puertos adicionales ni iniciar brazos nuevos.

### Caso G — Chancho posterior

En modo Ramificado, el primer chancho adquiere capacidad cuatro. Cualquier chancho posterior funciona como ordinario y no se añade a `specialDoublePlacementIds`.

### Caso H — Puntuación del chancho

Para un mismo chancho `N`: con una conexión aporta `2N`; con dos, tres o cuatro conexiones aporta 0. Las conexiones tercera y cuarta solo son posibles si es el chancho ramificador.

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
