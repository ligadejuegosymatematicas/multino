# Sistema de puntuación

## Estado normativo

La puntuación de una partida está formalizada por R-014 a R-026. Este documento organiza sus cálculos para futura implementación; no contiene código ejecutable.

## 1. Puntos después de una jugada

Después de cada jugada:

1. se calcula `S`, suma de los extremos abiertos (R-014);
2. si `S = 5m`, se conceden `m = S / 5` puntos al equipo del jugador (R-015);
3. si `S` no es múltiplo de 5, se conceden 0 puntos (R-016).

La última jugada pasa por este cálculo antes del resultado final (R-017).

Ejemplos normativos directos:

| S | Puntos |
| ---: | ---: |
| 0 | 0 |
| 5 | 1 |
| 10 | 2 |
| 13 | 0 |
| 25 | 5 |

## 2. Aporte de chanchos

Para un chancho `N`:

| Conexiones existentes | Aporte a S |
| ---: | ---: |
| 0 | `2N` |
| 1 | `2N` |
| 2 o más | `0` |

Esta tabla corresponde a R-018. R-019 permite que un chancho especial acepte conexiones tercera y cuarta aunque su aporte permanezca en 0.

Ejemplo: un `5–5` con una conexión aporta 10; desde su segunda conexión aporta 0.

## 3. Vencedor tradicional

Existe vencedor tradicional en dos casos:

- salida: el equipo del jugador que coloca su última ficha (R-020);
- tranque con sumas distintas: el equipo con menor suma de fichas restantes (R-021).

Si las sumas de ambos equipos son iguales en un tranque, no existe vencedor tradicional y ambos reciben bonificación 0 (R-022).

## 4. Bonificación final

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

## 5. Puntaje final y resultado

Para cada equipo:

```text
puntaje final = puntos durante el juego + bonificación final
```

Gana el puntaje final mayor; puntajes finales iguales producen empate (R-024 a R-026).

## Marcador normativo e historial

- `score.teams[teamId]` se persiste en el snapshot y es el marcador operativo actual.
- Cada acción `PLAY_DOMINO` aceptada registra `scoreAwarded` para explicar cómo cambió ese marcador.
- Durante juego activo, `score` contiene solo puntos obtenidos después de jugadas.
- Al finalizar, la bonificación se aplica exactamente una vez y el marcador pasa a contener el puntaje final de R-024.
- `S` continúa siendo efímero: se calcula desde el tablero después de cada jugada y no se persiste.
- La UI representa `score`; no mantiene un marcador paralelo con autoridad.

Snapshot e historial deben coincidir, pero el motor no recorre el historial para conocer el marcador presente.

## Proyección visual de S

Una UI puede mostrar `S = 2 + 5 + 5 + 5 + 6 = 23` o su forma agrupada, pero debe recibir del motor el desglose lógico y el total. GraphRenderer no recalcula puntuación a partir del número de curvas dibujadas.

Esta separación es necesaria porque destinos legales y términos de S no son uno-a-uno para los chanchos:

- un chancho con una conexión aporta `2N`, aunque visualmente tenga otro número de puertos disponibles;
- un chancho especial con dos o más conexiones puede conservar destinos laterales y aportar 0.

La proyección puede enlazar fuentes de puntuación y objetivos mediante IDs de colocación/puerto, agrupar el aporte del chancho y destacar visualmente qué elementos explican el total. El contrato detallado se estudia en [`modo-grafo.md`](modo-grafo.md).

## Cierre de la especificación de S

R-028 define compatibilidad por igualdad y R-031 a R-035 fijan línea principal, puertos especiales y ramificaciones. Con estas reglas, el conjunto lógico de extremos abiertos y el aporte de cada chancho pueden determinarse sin geometría. No queda un vacío normativo de puntuación que bloquee Fase 1.

## Variantes no normativas

`Divisible por n` y `Sin divisibilidad` son hipótesis futuras documentadas en [`variantes-futuras.md`](variantes-futuras.md). La generalización no está autorizada: en particular, todavía no se ha definido cómo se relacionaría `n` con la bonificación de R-023. Al implementar el modo aprobado conviene localizar el literal 5 en la política de puntuación, sin exponer configuraciones no reglamentadas.
