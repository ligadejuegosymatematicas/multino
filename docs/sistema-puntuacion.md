# Sistema de puntuación

## Estado normativo

La puntuación de una partida está formalizada por R-014 a R-026. El Bloque 4 implementa R-014 a R-019 para los puntos producidos durante jugadas. Vencedor tradicional, bonificación y resultado definitivo de R-020 a R-026 continúan pendientes.

## 1. Puntos después de una jugada

Después de cada jugada:

1. se calcula `S`, suma de los extremos abiertos (R-014);
2. si `S = 5m`, se conceden `m = S / 5` puntos al equipo del jugador (R-015);
3. si `S` no es múltiplo de 5, se conceden 0 puntos (R-016).

La última jugada pasa por este cálculo antes del resultado final (R-017).

El motor expone tres consultas puras:

- `getScoringTerms(state)`: desglose explicable de fuentes actuales;
- `calculateOpenEndsSum(state)`: suma exclusivamente sus `contribution`;
- `calculateMoveScore(S)`: aplica la política fija de múltiplos de 5.

Ejemplos normativos directos:

| S | Puntos |
| ---: | ---: |
| 0 | 0 |
| 5 | 1 |
| 10 | 2 |
| 13 | 0 |
| 25 | 5 |

## 2. Términos de fichas no dobles

Cada lado libre de una ficha no doble produce un término independiente:

```js
{
  placementId: "placement-7",
  dominoId: "2-5",
  portId: "side:b",
  value: 5,
  contribution: 5,
  reason: "OPEN_ORDINARY_SIDE"
}
```

Una ficha inicial no doble tiene dos lados libres y produce dos términos. Con una conexión produce uno; con ambas caras conectadas no produce términos y, por tanto, aporta 0. Fuentes distintas con el mismo valor permanecen como términos separados.

## 3. Aporte de chanchos

Para un chancho `N`:

| Conexiones existentes | Aporte a S |
| ---: | ---: |
| 0 | `2N` |
| 1 | `2N` |
| 2 o más | `0` |

Esta tabla corresponde a R-018. R-019 permite que un chancho especial acepte conexiones tercera y cuarta aunque su aporte permanezca en 0.

Ejemplo: un `5–5` con una conexión aporta 10; desde su segunda conexión aporta 0.

Cada chancho produce exactamente un término agrupado con `placementId`, `dominoId`, `connectionCount`, `contribution` y uno de estos motivos:

- `DOUBLE_WITH_AT_MOST_ONE_CONNECTION`;
- `DOUBLE_WITH_TWO_OR_MORE_CONNECTIONS`.

El término de un chancho con dos o más conexiones se conserva con contribución 0. Esto permite explicar que un chancho especial todavía puede tener destinos libres sin aportar a S.

## 4. Vencedor tradicional — pendiente

Existe vencedor tradicional en dos casos:

- salida: el equipo del jugador que coloca su última ficha (R-020);
- tranque con sumas distintas: el equipo con menor suma de fichas restantes (R-021).

Si las sumas de ambos equipos son iguales en un tranque, no existe vencedor tradicional y ambos reciben bonificación 0 (R-022).

## 5. Bonificación final — pendiente

Si existe vencedor tradicional, `a` es la suma de los valores de las fichas restantes del equipo rival. Escribiendo `a = 5q + r`:

| Residuo r | Bonificación |
| ---: | ---: |
| 0, 1 o 2 | `q` |
| 3 o 4 | `q + 1` |

Esto equivale al entero más cercano a `a / 5` (R-023).

Ejemplos normativos:

| a | q | r | Bonificación |
| ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0 |
| 12 | 2 | 2 | 2 |
| 13 | 2 | 3 | 3 |
| 19 | 3 | 4 | 4 |
| 20 | 4 | 0 | 4 |

## 6. Puntaje final y resultado — pendiente

Para cada equipo:

```text
puntaje final = puntos durante el juego + bonificación final
```

Gana el puntaje final mayor; puntajes finales iguales producen empate (R-024 a R-026).

## Marcador normativo e historial

- `score.teams[teamId]` se persiste en el snapshot y es el marcador operativo actual.
- Cada acción reglamentaria `PLAY_DOMINO` aceptada registra `openEndsSum` y `scoreAwarded` para explicar cómo cambió ese marcador.
- Durante el alcance actual, tanto en estado activo como terminal, `score` contiene solo puntos obtenidos después de jugadas.
- El desglose de `scoringTerms` es derivado y no se persiste; únicamente se guarda el total S compacto del evento.
- La UI representa `score`; no mantiene un marcador paralelo con autoridad.

Snapshot e historial deben coincidir exactamente: por equipo, el marcador es la suma de `scoreAwarded` de sus jugadores. El motor no recorre el historial para conocer el marcador durante la operación normal; la reconciliación pertenece a la validación del snapshot.

## Proyección visual de S

Una UI puede mostrar `S = 2 + 5 + 5 + 5 + 6 = 23` o su forma agrupada, pero debe recibir del motor el desglose lógico y el total. GraphRenderer no recalcula puntuación a partir del número de curvas dibujadas.

Esta separación es necesaria porque destinos legales y términos de S no son uno-a-uno para los chanchos:

- un chancho con una conexión aporta `2N`, aunque visualmente tenga otro número de puertos disponibles;
- un chancho especial con dos o más conexiones puede conservar destinos laterales y aportar 0.

La proyección puede enlazar fuentes de puntuación y objetivos mediante IDs de colocación/puerto, agrupar el aporte del chancho y destacar visualmente qué elementos explican el total. El contrato detallado se estudia en [`modo-grafo.md`](modo-grafo.md).

## Cierre e implementación de S

R-028 define compatibilidad por igualdad y R-031 a R-035 fijan línea principal, puertos especiales y ramificaciones. El Bloque 4 deriva términos y S directamente de ese tablero, sin geometría y sin usar `getOpenEndTargets` como sustituto.

## Variantes no normativas

`Divisible por n` y `Sin divisibilidad` son hipótesis futuras documentadas en [`variantes-futuras.md`](variantes-futuras.md). La generalización no está autorizada: en particular, todavía no se ha definido cómo se relacionaría `n` con la bonificación de R-023. El literal 5 permanece concentrado en el módulo de puntuación y no se expone como configuración.
