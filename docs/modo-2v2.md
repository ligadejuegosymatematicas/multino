# Modo local 2 vs 2

## Configuración normativa

- Cuatro jugadores forman dos equipos de dos (R-003).
- Los compañeros se alternan en los asientos (R-004).
- El orden de asientos se persiste en sentido antihorario (R-009).
- Cada jugador recibe siete fichas y no existe pozo (R-006).

Una representación lógica posible es:

```js
seating: {
  counterclockwisePlayerIds: ["A1", "B1", "A2", "B2"]
}
```

Los IDs son técnicos y no obligan a dibujar posiciones determinadas. Cualquier rotación de la secuencia conserva la alternancia; la UI decide dónde aparece cada asiento.

## Inicio y turnos

El jugador que posee `6–6` es el inicial (R-007), pero puede jugar cualquier ficha de su mano (R-008). Después de una jugada o pase, el turno avanza al siguiente ID del orden antihorario (R-009).

Cada turno acepta una sola jugada legal o un pase cuando no existe jugada legal (R-010, R-011). Cuatro pases consecutivos terminan la partida por tranque (R-012, R-013).

## Final de partida

La partida termina por salida o tranque. El vencedor tradicional, la bonificación y el resultado final se calculan con R-020 a R-026. No existe una meta acumulada de varias partidas dentro del reglamento actual.

## Separación de responsabilidades

- `Team` relaciona equipo y jugadores.
- `Player` contiene identidad de dominio, no posición visual.
- `seating.counterclockwisePlayerIds` expresa el ciclo de turnos.
- `hands[playerId]` contiene fichas todavía no jugadas.
- El bloque inicial aplica R-007 al determinar `currentPlayerId`; `TurnManager` aplicará los cambios de turno, pases y cierre en bloques posteriores.
- La UI decide cómo mostrar u ocultar cada mano en el dispositivo local.

## Convención técnica de reparto

Una vez mezclada la secuencia de 28 IDs, la ficha de índice `i` se entrega al jugador ubicado en el índice `i mod 4` de `counterclockwisePlayerIds`. El ciclo se repite siete veces y produce cuatro manos de siete. Esta convención hace determinista el reparto dada una permutación, pero no amplía R-006/R-029 ni prescribe una ceremonia física concreta.

## Especificación cerrada para el motor básico

- R-029 exige mezcla aleatoria; el algoritmo es una decisión de implementación con fuente inyectable.
- R-028 define compatibilidad por igualdad.
- R-030 asigna al jugador la elección entre todas las jugadas legales enumeradas.
- R-031 a R-035 determinan línea principal, puertos especiales y cadenas laterales.

Permanecen fuera del reglamento básico la forma de ocultar manos en un único dispositivo y una posible serie de varias partidas.

## Privacidad futura

En local, ocultar una mano es UX. En remoto, es seguridad: el servidor no debe enviar manos ajenas en la proyección de un jugador. El estado completo y la vista autorizada serán contratos distintos en Fase 6.
