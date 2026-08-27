# Modelo futuro Round / Match

## Estado de la propuesta

El snapshot v3 no se modifica en esta intervención. Actualmente representa una partida completa desde el reparto hasta salida o tranque; en terminología futura, ese ciclo corresponde principalmente a una **ronda**.

La separación aquí descrita solo será necesaria si se aprueban múltiples rondas o condiciones de victoria acumuladas.

## Conceptos

### Round

Una ronda comienza con mezcla y reparto y termina por:

- salida de un jugador;
- juego trancado.

Contiene las manos, el tablero, turno, pases, K de esa ronda, marcador de ronda, resultado e historial de acciones de juego.

### Match

Un match coordina una o varias rondas bajo una configuración estable. Puede terminar después de una ronda, al alcanzar un número de rondas ganadas o al alcanzar una meta de puntos.

Contiene participantes, política de puntuación, política de victoria, acumulados, resúmenes de rondas y referencia a la ronda activa.

## Esquema conceptual futuro

```js
{
  schemaVersion: 4, // solo ilustrativo; no aprobado
  matchId: "...",
  phase: "playing",

  participants: {
    players: {},
    teams: {},
    seating: {}
  },

  rules: {
    scoringPolicy: { type: "divisible", divisor: 5 },
    victoryPolicy: { type: "single-round" }
  },

  matchScore: {
    roundWinsByTeam: {},
    accumulatedPointsByTeam: {}
  },

  currentRound: {
    roundId: "...",
    roundNumber: 1,
    phase: "playing",
    turnNumber: 1,
    currentPlayerId: "...",
    consecutivePasses: 0,
    dominoes: {},
    hands: {},
    board: {},
    score: { teams: {} },
    config: { specialMainLineDoublesLimit: 2 },
    history: []
  },

  completedRounds: []
}
```

La forma es deliberadamente conceptual. No autoriza `schemaVersion: 4`, nuevos campos ni migraciones.

## Propiedad de cada dato

| Dato | RoundState | MatchState |
| --- | --- | --- |
| manos y tablero | Sí | Solo mediante ronda activa |
| turno y pases | Sí | No |
| K | Sí, porque R-027 lo fija antes de cada ronda | Puede ofrecer un valor predeterminado, no sustituir el de ronda |
| puntos producidos en la ronda | Sí | Resumen/acumulado si la política lo exige |
| historial de jugadas | Sí | Puede conservar referencias o archivos de rondas |
| participantes y equipos | Referencias | Fuente estable del match |
| scoring policy | Aplicada en la ronda | Configuración estable prevista |
| victory policy | No decide jugadas | Sí |
| rondas ganadas/meta | No | Sí |

Un snapshot completo de match debe seguir siendo autosuficiente. Separar responsabilidades no obliga a usar event sourcing ni a cargar documentos externos para continuar.

## Resultados de ronda y acumulación

Una ronda futura debería producir un resumen inmutable, conceptualmente:

```js
{
  roundId: "round-2",
  endReason: "OUT" | "BLOCKED",
  traditionalWinnerTeamId: "A" | null,
  finalRoundScoreByTeam: { A: 7, B: 4 },
  winnerTeamId: "A" | null,
  historyDigest: "..."
}
```

Los campos exactos dependen de reglas futuras. En particular, vencedor tradicional, ganador por puntaje y ganador del match no deben confundirse.

## Políticas de victoria

### Una ronda

El match termina con el resultado de su única ronda. Es la forma compatible con el snapshot actual y no necesita un wrapper complejo.

### Mejor de 3

El match termina cuando un equipo alcanza dos rondas ganadas. Antes de implementarlo debe definirse si una ronda empatada se ignora, se cuenta, se repite o activa otro criterio.

### Mejor de 5

El match termina cuando un equipo alcanza tres rondas ganadas. Comparte el problema de empates y añade riesgo de duración excesiva.

### Meta de puntos

El match termina cuando un acumulado autorizado alcanza una meta. Debe formalizarse:

- qué puntaje de la ronda se acumula;
- si la meta debe alcanzarse o superarse;
- qué sucede si ambos equipos la alcanzan en la misma ronda;
- si existe diferencia mínima;
- cómo se presenta y audita la bonificación.

Los ejemplos 50 y 100 son candidatos de simulación, no valores aprobados.

## UI y renderers

La UI debe separar al menos:

- `roundScore`: puntos de la ronda activa;
- `matchScore`: acumulado si existe;
- `roundWins`: rondas ganadas en series;
- `roundNumber` y condición de cierre del match.

GraphRenderer y TraditionalRenderer representan la ronda activa. Un panel superior de match puede ser compartido por ambos. Cambiar renderer no cambia ningún acumulado.

## Persistencia e historial

- El historial de una ronda permite su replay visual completo.
- El match puede conservar resúmenes de rondas finalizadas y, opcionalmente, sus historiales completos.
- La política de retención debe decidirse antes de prometer replay de todas las rondas.
- No conviene duplicar cada snapshot intermedio; se puede conservar snapshot final más acciones aceptadas.

## Estrategia de evolución

1. Mantener snapshot v3 y `createMatch` sin refactor durante el motor de una ronda.
2. Evitar que el módulo de puntuación aprobado disperse el literal 5 o conozca una meta de match.
3. Definir reglas de una variante multirronda antes de diseñar schema v4.
4. Introducir un coordinador de match alrededor del motor de ronda, no dentro del tablero.
5. Diseñar migración explícita solo cuando exista un contrato aprobado.

## Decisiones pendientes

- terminología pública futura de `createMatch` frente a `createRound`;
- ganador de ronda en cada scoring policy;
- tratamiento de rondas empatadas;
- política de acumulación y metas;
- conservación de K entre rondas;
- retención de historiales completos;
- privacidad de rondas anteriores en multijugador.

Ninguna de estas decisiones bloquea el Bloque 2 si ese bloque continúa limitado al motor de una única ronda aprobada.
