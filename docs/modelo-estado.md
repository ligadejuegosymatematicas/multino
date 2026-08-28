# Modelo de estado serializable

## Principio

El snapshot contiene toda la información necesaria para continuar desde el presente sin recorrer `history`. El proyecto no usa event sourcing puro.

`history` sigue siendo obligatorio para auditoría, debugging, replay, comprobación de invariantes y sincronización futura, pero no es la fuente necesaria del marcador, los pases consecutivos ni la capacidad especial actual.

## Esquema vigente v5

```js
{
  schemaVersion: 5,
  matchId: null,
  phase: "setup",
  turnNumber: 0,
  currentPlayerId: null,
  consecutivePasses: 0,

  teams: {},
  players: {},
  seating: {
    counterclockwisePlayerIds: []
  },

  dominoes: {},
  hands: {},
  board: {
    placements: {},
    connections: {},
    mainLine: {
      placementIds: []
    },
    specialDoublePlacementIds: []
  },

  score: {
    teams: {}
  },
  config: {
    specialMainLineDoublesLimit: null
  },
  history: []
}
```

Los mapas `teams`, `hands` y `score.teams` usan los mismos IDs de equipo o jugador declarados en el snapshot.

## Snapshot inicial implementado

`createMatch` construye la transición conceptual `setup → playing` de forma atómica. No publica el estado intermedio. Un resultado exitoso usa la forma v5 con estos valores iniciales:

```js
{
  schemaVersion: 5,
  phase: "playing",
  turnNumber: 1,
  currentPlayerId: "<jugador que posee 6-6>",
  consecutivePasses: 0,
  dominoes: { /* 28 fichas indexadas por ID a-b */ },
  hands: { /* cuatro arrays disjuntos de siete IDs */ },
  board: {
    placements: {},
    connections: {},
    mainLine: { placementIds: [] },
    specialDoublePlacementIds: []
  },
  score: { teams: { /* ambos equipos en 0 */ } },
  config: { specialMainLineDoublesLimit: K },
  history: []
}
```

No existe `stock`: la unión de las manos es exactamente el catálogo. `effectiveK` se calcula con `min(K, 7)` y no se persiste. El historial vacío es deliberado: generación, mezcla y reparto son pasos internos de creación, no acciones de dominio que aporten valor al replay.

## Información actual persistida

- Fase, número de turno, jugador actual y pases consecutivos.
- Cuatro jugadores, dos equipos y orden antihorario.
- Catálogo doble-seis y ubicación actual de cada ficha.
- Grafo del tablero, recorrido principal ordenado y colocaciones especiales.
- Marcador actual por equipo.
- K reglamentario original.
- Historial de acciones aceptadas.
- En estado terminal, motivo de cierre y actor/equipo de salida cuando corresponda.

Con estos campos, el motor puede enumerar las jugadas del jugador actual, decidir si un pase completa el tranque, consultar la capacidad de cada chancho y continuar el marcador sin reconstruir acciones anteriores.

`applyPlay` implementa la parte topológica mediante una operación de bajo nivel que recibe `playerId` explícito y no altera turno, pases ni marcador. `applyTurnAction` restringe al jugador actual, valida contra `getAvailableActions`, compone `applyPlay`, calcula y acredita la puntuación de `PLAY_DOMINO`, coordina pases y produce terminación básica. `PASS` nunca toca el marcador.

## Fase y resultado terminal

Mientras la ronda está activa usa `phase: "playing"` y no contiene la propiedad `roundResult`. Al terminar usa una de estas formas mínimas:

```js
{
  phase: "finished",
  roundResult: {
    reason: "EMPTY_HAND",
    finishingPlayerId: "P3",
    finishingTeamId: "A"
  }
}
```

```js
{
  phase: "finished",
  roundResult: {
    reason: "BLOCKED"
  }
}
```

`EMPTY_HAND` identifica al jugador cuya mano quedó vacía y su equipo. `BLOCKED` no declara ganador: las manos restantes permiten que el bloque posterior calcule el vencedor tradicional. No existen todavía `finalScore`, `bonus`, `winnerByScore` ni campos equivalentes.

El Bloque 3 elevó `schemaVersion` a 4 para formalizar `roundResult`, `turnNumber` e historial reglamentario. El Bloque 4 lo eleva a 5 porque todo `PLAY_DOMINO` reglamentario exige ahora `openEndsSum` y `scoreAwarded`, y `score.teams` debe coincidir exactamente con esos eventos. No existen partidas persistidas reales que requieran migración.

## Marcador normativo

`score.teams[teamId]` es el puntaje actual y la fuente operativa para continuar la partida.

- Durante una partida activa contiene únicamente puntos concedidos después de jugadas por R-014 a R-019.
- En el alcance actual conserva esa misma semántica al terminar: todavía no incorpora bonificación.
- La bonificación y la comparación del marcador final conforme a R-020 a R-026 pertenecen al bloque posterior.

Cada acción reglamentaria `PLAY_DOMINO` conserva `history[].result.openEndsSum` y `history[].result.scoreAwarded`. Esa información explica el marcador, pero no lo sustituye. El desglose completo de `getScoringTerms` no se persiste porque se deriva del tablero.

Invariante conceptual:

```text
score actual
= suma de scoreAwarded de acciones PLAY_DOMINO aceptadas por equipo
```

La igualdad es exacta mientras no exista bonificación final. Una discrepancia entre snapshot e historial invalida el estado; no obliga al motor a recalcular el presente durante la operación normal.

## Número de turno

En `phase: "playing"`, `turnNumber` es el número de la acción reglamentaria que está por ejecutarse:

- el snapshot inicial usa 1;
- cada `PLAY_DOMINO` o `PASS` no terminal registra ese número y deja el siguiente snapshot con `turnNumber + 1`;
- cada entrada reglamentaria cumple `history.sequence === history.turn`;
- no existen dos acciones reglamentarias con el mismo turno.

En `phase: "finished"` no existe una próxima acción. El snapshot conserva en `turnNumber` el número de la acción que terminó la ronda, que coincide con `history.length` y con `history.at(-1).turn`. `currentPlayerId` conserva al actor terminal y no avanza a un jugador ficticio.

## Pases consecutivos

`consecutivePasses` se persiste porque determina si el próximo pase produce tranque:

- comienza en 0;
- aumenta después de un pase aceptado;
- vuelve a 0 después de una jugada aceptada;
- alcanza 4 cuando la partida termina por R-012.

El historial permite verificar el contador, pero no es necesario para consultarlo.

El evento `PASS` no duplica el contador. `consecutivePasses` se valida contando la cola de eventos `PASS`; el cuarto pase produce `phase: "finished"` y `reason: "BLOCKED"`.

## Condición especial

`board.specialDoublePlacementIds` persiste la condición histórica adquirida. El motor consulta directamente esta lista para determinar si una colocación dispone de puertos `main:*` y `branch:*`.

La lista debe ser coherente con K, catálogo, `mainLine` e historial, pero ninguna de esas comprobaciones reemplaza el valor normativo del snapshot.

## Información derivada sin historial

A partir del snapshot actual se derivan:

- `effectiveK = min(K, 7)`;
- si una ficha es chancho;
- ramas y pertenencia de colocaciones no principales;
- extremos principales, extremos terminales de ramas y puertos `branch:*` libres;
- jugadas legales actuales;
- términos explicables de puntuación y suma `S` actual;
- geometría de renderizado.

Estas propiedades no requieren recorrer `history`.

Vencedor tradicional, bonificación y resultado final también podrán derivarse desde las manos y el marcador, pero su comportamiento todavía no está implementado.

También son derivadas la proyección de las fichas sobre el grafo de valores `0–6`, la agrupación de extremos por valor y cualquier fórmula visual de S. El modo de visualización seleccionado, el zoom, las coordenadas, el foco y las animaciones son preferencias de UI y no forman parte del snapshot.

## Historial

Acción `PLAY_DOMINO` vigente:

```js
{
  sequence: 10,
  turn: 10,
  playerId: "A2",
  type: "PLAY_DOMINO",
  payload: {
    dominoId: "5-5",
    target: {
      kind: "OPEN_END",
      placementId: "placement-8",
      portId: "branch:1"
    }
  },
  result: {
    placementId: "placement-10",
    connectionId: "connection-9",
    openEndsSum: 15,
    scoreAwarded: 3
  }
}
```

Para la primera ficha, `payload.target` es `{ kind: "START" }` y `connectionId` es `null`. `openEndsSum` registra S sobre el tablero resultante y `scoreAwarded` registra los puntos efectivamente concedidos, incluido 0. El historial conserva causalidad y orden. Puede reproducir o auditar el snapshot, pero una carga válida no necesita reproducirlo antes de continuar.

La primitiva `applyPlay` crea inicialmente el evento topológico con `placementId` y `connectionId`; `applyTurnAction` enriquece esa misma entrada con S y puntos, sin duplicarla. Por ello, un snapshot producido solo por la API de bajo nivel puede validarse con `validateBoardState`, pero no es un snapshot reglamentario v5 hasta completar la transición superior.

Acción `PASS` vigente:

```js
{
  sequence: 11,
  turn: 11,
  playerId: "B1",
  type: "PASS",
  payload: {},
  result: {}
}
```

`consecutivePassesAfter` y `finished` no se duplican dentro del evento: se derivan de la secuencia y del snapshot resultante. `applyTurnAction` produce exactamente una entrada por acción. Para `PLAY_DOMINO`, reutiliza la entrada creada por `applyPlay`; para `PASS`, crea la forma anterior.

## Sin pozo

No existe `stock`. Al comenzar el juego, las 28 fichas están distribuidas entre cuatro manos de siete conforme a R-006 y R-029. Una colección temporal usada dentro de una operación atómica de reparto no pertenece a un snapshot válido.

## Serialización y validación

- Solo tipos JSON y referencias por ID.
- K se valida como entero no negativo y se conserva aunque sea mayor que 7.
- Los cuatro jugadores, dos equipos, 28 fichas y ubicaciones deben ser coherentes.
- Marcador y contador de pases son enteros no negativos; el contador no supera 4.
- Tablero, lista especial e historial deben satisfacer sus invariantes cruzados.
- `schemaVersion` se incrementa ante cambios incompatibles.

El validador inicial comprueba schema, participantes, equipos, alternancia, K, catálogo, manos, ubicación única, tablero vacío, marcador, pases, jugador inicial, historial vacío, ausencia de `roundResult` y serialización JSON. `validateBoardState` valida la topología tanto en `playing` como en `finished`. `validateRoundState` añade turnos únicos, orden antihorario, jugador actual, cola de pases, forma de eventos, coherencia de `roundResult`, mano vacía, bloqueo, S/puntos registrados y la igualdad exacta entre historial y marcador. La bonificación y el resultado definitivo corresponden al bloque posterior.

El esquema v5 sustituye al v4 para hacer obligatoria la auditoría de puntuación de cada jugada y la coherencia exacta `score ↔ history`. No se implementa migración v4→v5 porque no existen partidas persistidas reales. Un snapshot construido solo mediante `applyPlay` puede seguir validándose topológicamente mediante `validateBoardState`, pero no se presenta como snapshot reglamentario v5.

## Guardado, replay y red

- **Guardar:** persiste el snapshot v5 autosuficiente y el historial asociado.
- **Cargar:** valida el snapshot directamente; no necesita reproducir el historial.
- **Replay:** usa el historial cuando el usuario solicita reconstrucción temporal.
- **Red:** puede enviar snapshots autoritativos compactos y acciones incrementales, con proyecciones que oculten manos ajenas.

## Round y Match futuros

Aunque la API actual se denomina `createMatch`, el snapshot v5 cubre un único ciclo desde reparto hasta salida o tranque. No se renombra ni refactoriza mientras solo exista esa modalidad.

Si se aprueban múltiples rondas, un futuro `MatchState` podrá envolver un `RoundState` equivalente al estado actual y añadir política de victoria, rondas ganadas o puntos acumulados. Esa evolución requerirá reglas y versión de esquema propias; no justifica agregar campos preventivos a v5. Véase [`modelo-round-match.md`](modelo-round-match.md).
