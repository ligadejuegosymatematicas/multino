# Modelo de estado serializable

## Principio

El snapshot contiene toda la información necesaria para continuar desde el presente sin recorrer `history`. El proyecto no usa event sourcing puro.

`history` sigue siendo obligatorio para auditoría, debugging, replay, comprobación de invariantes y sincronización futura, pero no es la fuente necesaria del marcador, los pases consecutivos ni la capacidad especial actual.

## Esquema propuesto v3

```js
{
  schemaVersion: 3,
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

`createMatch` construye la transición conceptual `setup → playing` de forma atómica. No publica el estado intermedio. Un resultado exitoso conserva la forma v3 anterior con estos valores iniciales:

```js
{
  schemaVersion: 3,
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

Con estos campos, el motor puede enumerar las jugadas del jugador actual, decidir si un pase completa el tranque, consultar la capacidad de cada chancho y continuar el marcador sin reconstruir acciones anteriores.

El Bloque 2 implementa la parte topológica mediante una operación de bajo nivel que recibe `playerId` explícito. Después de la primera colocación no autoriza ni avanza por sí misma el turno: `currentPlayerId`, `turnNumber`, `consecutivePasses` y `score` quedan intactos hasta que un bloque posterior incorpore el coordinador de turnos y puntuación.

## Marcador normativo

`score.teams[teamId]` es el puntaje actual y la fuente operativa para continuar la partida.

- Durante una partida no terminada contiene únicamente puntos concedidos después de jugadas por R-014 a R-019.
- Al finalizar incorpora la bonificación correspondiente a R-020 a R-024.
- El ganador o empate se determina comparando este marcador final conforme a R-025 y R-026.

Cada acción `PLAY_DOMINO` puede conservar `history[].result.scoreAwarded`. La acción terminal o su resultado puede registrar también la bonificación final para auditoría. Esa información explica el marcador, pero no lo sustituye.

Invariante conceptual:

```text
score actual
= suma de scoreAwarded de acciones PLAY_DOMINO aceptadas por equipo
+ bonificación final aplicada al terminar, cuando corresponda
```

Una discrepancia entre snapshot e historial invalida el estado; no obliga al motor a recalcular el presente durante la operación normal.

## Pases consecutivos

`consecutivePasses` se persiste porque determina si el próximo pase produce tranque:

- comienza en 0;
- aumenta después de un pase aceptado;
- vuelve a 0 después de una jugada aceptada;
- alcanza 4 cuando la partida termina por R-012.

El historial permite verificar el contador, pero no es necesario para consultarlo.

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
- suma `S` posterior a una jugada;
- vencedor tradicional, bonificación esperada y resultado final usando manos, fase, contador y marcador;
- geometría de renderizado.

Estas propiedades no requieren recorrer `history`.

También son derivadas la proyección de las fichas sobre el grafo de valores `0–6`, la agrupación de extremos por valor y cualquier fórmula visual de S. El modo de visualización seleccionado, el zoom, las coordenadas, el foco y las animaciones son preferencias de UI y no forman parte del snapshot.

## Historial

Propuesta de acción:

```js
{
  sequence: 10,
  turn: 1,
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
    connectionId: "connection-9"
  }
}
```

Para la primera ficha, `payload.target` es `{ kind: "START" }` y `connectionId` es `null`. El Bloque 2 no escribe `scoreAwarded: 0`: el campo se incorporará cuando exista un cálculo real. El historial conserva causalidad y orden. Puede reproducir o auditar el snapshot, pero una carga válida no necesita reproducirlo antes de continuar.

## Sin pozo

No existe `stock`. Al comenzar el juego, las 28 fichas están distribuidas entre cuatro manos de siete conforme a R-006 y R-029. Una colección temporal usada dentro de una operación atómica de reparto no pertenece a un snapshot válido.

## Serialización y validación

- Solo tipos JSON y referencias por ID.
- K se valida como entero no negativo y se conserva aunque sea mayor que 7.
- Los cuatro jugadores, dos equipos, 28 fichas y ubicaciones deben ser coherentes.
- Marcador y contador de pases son enteros no negativos.
- Tablero, lista especial e historial deben satisfacer sus invariantes cruzados.
- `schemaVersion` se incrementa ante cambios incompatibles.

El validador inicial implementado comprueba schema, participantes, equipos, alternancia, K, catálogo, manos, ubicación única, tablero vacío, marcador, pases, jugador inicial, historial vacío y serialización JSON. `validateBoardState` añade para tableros ocupados IDs canónicos, línea principal, puertos, compatibilidad, ramas, condición especial, ubicación única e historial de colocaciones. La coherencia de puntuación, turnos, pases y estados terminales corresponde a bloques posteriores.

El esquema v3 sustituye al v2 antes de existir partidas persistidas reales. No se implementan migraciones en esta intervención.

## Guardado, replay y red

- **Guardar:** persiste el snapshot v3 autosuficiente y el historial asociado.
- **Cargar:** valida el snapshot directamente; no necesita reproducir el historial.
- **Replay:** usa el historial cuando el usuario solicita reconstrucción temporal.
- **Red:** puede enviar snapshots autoritativos compactos y acciones incrementales, con proyecciones que oculten manos ajenas.

## Round y Match futuros

Aunque la API actual se denomina `createMatch`, el snapshot v3 cubre un único ciclo desde reparto hasta salida o tranque. No se renombra ni refactoriza mientras solo exista esa modalidad.

Si se aprueban múltiples rondas, un futuro `MatchState` podrá envolver un `RoundState` equivalente al estado actual y añadir política de victoria, rondas ganadas o puntos acumulados. Esa evolución requerirá reglas y versión de esquema propias; no justifica agregar campos preventivos a v3. Véase [`modelo-round-match.md`](modelo-round-match.md).
