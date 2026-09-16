# Invariantes del motor

Estos invariantes están autorizados por R-001 a R-035 y por las decisiones arquitectónicas. Los cinco bloques de Fase 1 validan el snapshot inicial, tablero, flujo reglamentario, puntuación y cierre completo de una ronda.

## Snapshot autosuficiente

- El estado completo es serializable a JSON y no contiene referencias circulares.
- El snapshot permite continuar sin recorrer `history`.
- `currentPlayerId`, `turnNumber`, `consecutivePasses`, `score` y la capacidad especial actual están persistidos.
- `history` audita el snapshot, pero no es necesario para consultarlo.
- Todos los IDs referenciados existen dentro del snapshot.
- Una acción rechazada no muta snapshot ni historial.
- Una acción aceptada deja nuevamente satisfechos todos los invariantes.
- `placement-N`, `connection-N` y `history.sequence` se derivan del snapshot; no dependen de contadores globales.

## Participantes, fichas y ubicación

- Existen cuatro jugadores y dos equipos de dos integrantes (R-003).
- Los equipos alternan en el orden circular antihorario (R-004, R-009).
- El catálogo contiene exactamente las 28 combinaciones no ordenadas `0 ≤ a ≤ b ≤ 6`, sin duplicados (R-005).
- `isDouble` se deriva comparando los dos valores y no se persiste en una ficha.
- Al comenzar, cada mano contiene siete fichas y no existe pozo (R-006, R-029).
- Cada ficha física aparece en exactamente una ubicación actual: una mano o una colocación.
- Una ficha jugada tiene una sola colocación y no permanece en una mano.

### Contrato inicial ya validado

- `schemaVersion` es 6 y el snapshot creado está en `phase: "playing"`, `turnNumber: 1`.
- `currentPlayerId` referencia al único jugador cuya mano contiene `6-6`.
- El tablero, `specialDoublePlacementIds` e `history` comienzan vacíos.
- Ambos equipos comienzan con marcador 0 y `consecutivePasses` comienza en 0.
- Las 28 fichas se encuentran exactamente una vez en las cuatro manos; no existe `stock`.

## Línea principal

- `mainLine` es un camino simple (R-031).
- La primera ficha jugada pertenece a `mainLine` (R-031).
- Cada colocación principal aparece exactamente una vez en `mainLine.placementIds`.
- Cada par consecutivo del array está unido por una conexión de continuidad principal.
- No existe una conexión principal entre elementos no consecutivos.
- El primer y último elemento del array contienen los dos extremos actuales del recorrido principal.
- Con una sola colocación, sus dos puertos de continuidad son ambos extremos principales.
- Una extensión principal solo agrega al inicio o al final del array.
- El orden del array no implica izquierda/derecha ni orientación visual.

## Ramificaciones

- Una colocación no principal pertenece a exactamente una cadena de ramificación (R-034, R-035).
- Todo brazo lateral se conecta al camino interno `mainLine` mediante exactamente un puerto `branch:*` del chancho ramificador.
- El puerto de origen pertenece a una colocación incluida en `specialDoublePlacementIds`.
- Una ramificación forma un camino simple con un único extremo terminal.
- Ninguna ramificación vuelve a conectarse con `mainLine` en otro punto.
- Dos ramificaciones distintas no se conectan entre sí.
- Una ramificación no origina otra ramificación.
- Ninguna colocación de ramificación aparece en `mainLine.placementIds`.
- `board.branches` y `placement.region` no se persisten; cualquier vista de ramas se reconstruye desde el grafo.

## Chancho ramificador y puertos

- `specialDoublePlacementIds` contiene únicamente colocaciones de chanchos presentes en `mainLine`.
- La lista no contiene duplicados y su longitud máxima es uno.
- Si existe, su único elemento es el primer doble colocado (R-001).
- La lista permanece estable durante la partida salvo futura regla explícita de deshacer.
- Solo una colocación incluida en `specialDoublePlacementIds` puede usar `main:1`, `main:2`, `branch:1` o `branch:2`.
- El chancho ramificador dispone de exactamente esos cuatro puertos lógicos, todos con valor N (R-032).
- `main:1` y `main:2` participan exclusivamente en continuidad principal.
- `branch:1` y `branch:2` participan exclusivamente como orígenes de ramas.
- Un chancho no especial posee solo sus dos lados tradicionales y como máximo dos conexiones.
- El chancho ramificador posee como máximo cuatro conexiones.
- Cada puerto admite como máximo una conexión.
- Una colocación especial agregada a una línea existente usa `main:1` como entrada canónica; `main:2` conserva la continuidad, sin significado geométrico.

## Compatibilidad

- Cada conexión une exactamente dos puertos de colocaciones distintas.
- Los valores unidos por una conexión son iguales (R-028).
- La igualdad se aplica en línea principal, ramificaciones y todos los puertos de chanchos.
- Una jugada legal referencia un extremo abierto existente y un lado compatible.
- Si existen varias jugadas legales, el conjunto enumerado por el motor las contiene todas y ninguna se selecciona automáticamente (R-030).
- Dos destinos con igual valor conservan IDs distintos `placementId:portId` y producen opciones de jugada distintas.

## Turnos, pase y terminación

- El jugador inicial posee `6–6`, pero su primera ficha no está forzada (R-007, R-008).
- El sucesor sigue el orden antihorario persistido (R-009).
- Una jugada aceptada coloca exactamente una ficha (R-010).
- `applyTurnAction` acepta únicamente `PLAY_DOMINO` y `PASS` de `currentPlayerId` en `phase: "playing"`.
- En una ronda activa, `turnNumber = history.length + 1` e identifica la próxima acción.
- Cada evento reglamentario usa `sequence === turn` y los actores recorren el ciclo antihorario sin saltos.
- `consecutivePasses` aumenta únicamente con un pase aceptado y se reinicia con una jugada aceptada.
- Un pase solo se acepta cuando no existe jugada legal (R-011).
- `consecutivePasses = 4` termina la partida por tranque (R-012, R-013).
- Una mano vacía después de una jugada termina la partida por salida (R-013, R-020).
- En `phase: "playing"` no existe `roundResult`, ninguna mano está vacía y `consecutivePasses < 4`.
- En `phase: "finished"`, `turnNumber` conserva el turno terminal, `currentPlayerId` conserva al actor y no se aceptan nuevas acciones.
- `roundResult.reason = "BLOCKED"` exige cuatro eventos `PASS` consecutivos y ninguna mano vacía.
- `roundResult.reason = "EMPTY_HAND"` identifica al jugador/equipo de salida, exige su mano vacía y una última acción `PLAY_DOMINO`.
- El último `PLAY_DOMINO` o cuarto `PASS` es el único evento de la acción terminal; no existe un evento artificial `ROUND_FINISHED`.

## Puntuación

- Después de cada jugada aceptada se calcula una vez `S` y se actualiza `score` (R-014 a R-017).
- `S` es exactamente la suma de `contribution` devuelta por `getScoringTerms`; no se recalcula por otra vía.
- Una ficha no doble produce un término por lado abierto; con ambos lados conectados no produce términos.
- Un chancho `N` aporta `2N` con 0 o 1 conexión y 0 con 2, 3 o 4 (R-018, R-033).
- La capacidad de conexión no se deduce del aporte a S (R-019, R-033).
- `PLAY_DOMINO.result` contiene enteros no negativos `openEndsSum` y `scoreAwarded`; `PASS.result` continúa vacío.
- `scoreAwarded` vale `openEndsSum / 5` solo cuando S es múltiplo de 5; en otro caso vale 0.
- En un snapshot activo, para cada equipo:

```text
score actual
= suma de history[].result.scoreAwarded en PLAY_DOMINO de sus jugadores
```

- En un snapshot terminal, `score` añade exactamente `roundResult.finalBonus` al vencedor tradicional, si existe.
- `remainingPipsByTeam` coincide con la suma de ambos lados de todas las fichas conservadas por los dos jugadores de cada equipo.
- En salida, `traditionalWinnerTeamId` es el equipo del jugador que vació la mano; en tranque es el equipo con menor total restante.
- Totales restantes iguales en tranque implican vencedor tradicional nulo y bonificación 0.
- Si existe vencedor tradicional, `finalBonus` redondea el total rival dividido por 5: residuos 0–2 bajan y 3–4 suben.
- La bonificación se acredita únicamente al vencedor tradicional. Las fichas del compañero del jugador que salió no forman parte del total rival.
- `winnerTeamId` identifica el marcador final mayor y puede diferir de `traditionalWinnerTeamId`.
- Puntajes finales iguales implican `winnerTeamId: null` e `isTie: true`; en otro caso `isTie` es falso.
- Una discrepancia entre marcador, historial y resultado terminal invalida el estado, pero la operación normal consulta `score` directamente.
- El `openEndsSum` del último `PLAY_DOMINO` coincide con S derivada del tablero actual, incluso si después hubo pases.

## Modo estructural

- La API pública solo acepta `RAMIFICADO` o `LINEAL` (R-027).
- En Ramificado, `specialDoublePlacementIds` contiene cero o un ID: el primer doble colocado.
- En Lineal, `specialDoublePlacementIds` permanece vacío y no existen puertos `branch:*`.
- Todo doble posterior al primero es ordinario y su grado máximo es dos.
- Schema v6 codifica internamente Ramificado como `1` y Lineal como `0`; no expone esa cifra al jugador.

## Fronteras arquitectónicas

- El motor no usa DOM, CSS, animaciones ni coordenadas.
- Horizontalidad y orientación gráfica pertenecen al renderer.
- La UI solicita una de las acciones legales enumeradas y representa el snapshot resultante.
- Persistencia y red validan snapshot e historial antes de entregarlos al motor.
