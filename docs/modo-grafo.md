# Modo Grafo

## Propósito y alcance

El Modo Grafo es la representación predeterminada prevista del juego aprobado, no una regla nueva. Este documento fija el modelo matemático de la vista, evalúa sus objetivos interactivos y deja decisiones visuales abiertas. No implementa el renderer.

## Modelo matemático exacto

Sea:

```text
V = {0, 1, 2, 3, 4, 5, 6}
```

Para un instante `t`, la vista contiene:

- una arista no dirigida `{N,M}` por cada ficha jugada `[N|M]` con `N ≠ M`;
- un lazo `{N,N}` por cada chancho jugado `[N|N]`.

Como el doble-seis contiene una sola ficha por par no ordenado:

- entre dos vértices diferentes existe como máximo una arista;
- cada vértice admite como máximo un lazo;
- no hay aristas paralelas y, por tanto, no es un multigrafo.

El material completo equivale a las 21 aristas de `K₇` más siete lazos posibles. Durante una ronda se muestra un subgrafo de esa estructura. Conviene llamarlo **grafo de valores con lazos y sin aristas paralelas**, porque “grafo simple” suele excluir lazos.

## Dos grafos que no deben confundirse

El proyecto utiliza dos construcciones diferentes:

1. **Grafo lógico del tablero:** nodos de colocación, puertos y conexiones. Conserva línea principal, ramas y destinos individuales; es parte del modelo del motor.
2. **Grafo de valores del renderer:** siete vértices; cada ficha jugada es una arista o lazo. Es una proyección visual.

El segundo colapsa todas las apariciones de un mismo valor en un vértice. Por sí solo no conserva el orden de la línea principal, la pertenencia a una rama ni la identidad de extremos repetidos. Esa información debe llegar como metadatos derivados del primer grafo.

La capa pura implementada conserva `dominoId`, `placementId`, actor, equipo, turno y secuencia derivados. No añade ninguno de esos campos al snapshot.

## Capa de proyección implementada

Los módulos dentro de `src/js/game/projections/` consumen el snapshot y consultas del motor. Devuelven objetos nuevos, no persisten resultados y no contienen DOM, Canvas, SVG, coordenadas ni decisiones de layout.

`getValueGraphProjection(state)` devuelve:

```js
{
  vertices: [
    { value: 0, incidentPlacementIds: [] },
    // siempre existen 0, 1, 2, 3, 4, 5 y 6
  ],
  edges: [
    {
      dominoId: "2-5",
      placementId: "placement-12",
      a: 2,
      b: 5,
      isLoop: false,
      playSequence: 12,
      turnNumber: 12,
      playerId: "P4",
      teamId: "B"
    }
  ]
}
```

Un lazo usa `a === b` e `isLoop: true`. `placementId` individualiza cada arista. `playSequence`, `turnNumber`, `playerId` y `teamId` se derivan del evento `PLAY_DOMINO` correspondiente. La proyección ordena aristas por `placement-N` y no persiste orientación visual.

Dos snapshots con las mismas fichas jugadas pueden producir exactamente este mismo grafo y conservar distinta línea principal o distintas ramas. Por ello, el grafo de valores nunca valida legalidad, reconstruye conexiones ni sustituye `board`.

## Identidad individual de los extremos

Los extremos abiertos no son aristas paralelas. Constituyen una colección derivada de destinos lógicos:

```js
{
  id: "placement-17:branch:2",
  value: 5,
  placementId: "placement-17",
  portId: "branch:2",
  kind: "branch-origin",
  branchOrigin: {
    placementId: "placement-17",
    portId: "branch:2"
  }
}
```

Esta es la forma vigente de `getOpenEndTargets`. `kind` distingue `main`, `branch-origin` y `branch`. Un destino principal añade `mainLineEnd: "start" | "end"`; un origen o terminal lateral añade `branchOrigin`. El ID se deriva canónicamente de `placementId + portId` y no se persiste.

La colección puede reconstruirse inequívocamente desde el snapshot:

1. obtener los dos extremos principales a partir del primer y último elemento de `mainLine.placementIds` y sus conexiones;
2. identificar cada `branch:*` libre de una colocación incluida en `specialDoublePlacementIds`;
3. recorrer cada componente fuera de `mainLine` desde su puerto especial de origen hasta su terminal;
4. emitir una entrada por cada puerto o terminal actualmente disponible.

`groupOpenEndsByValue(state)` devuelve un record con una lista por cada valor presente. `getOpenEndVisualProjection(state)` lo transforma en listas ordenadas `{ value, count, targets }`. Cada target permanece individual: `q` targets de valor M significan `q` futuras curvas seleccionables desde M. Ninguna de estas agrupaciones se persiste.

`getLegalPlayProjection(state, playerId)` agrupa los resultados de `getLegalPlays` por ficha:

```js
{
  dominoId: "2-5",
  legalTargetCount: 3,
  legalTargets: [/* targets completos e individualizados */]
}
```

`getLegalTargetsForDomino(state, playerId, dominoId)` devuelve directamente esa lista para resaltado futuro. En tablero vacío, el único destino proyectado es `{ kind: "START" }`. En una ronda terminada ambas consultas devuelven listas vacías, aunque el grafo y los extremos topológicos sigan consultables.

## Multiplicidad y límites de diseño

El número total de extremos disponibles no coincide con el número de vértices. En un tablero válido no vacío, el grafo de colocaciones es un árbol: cada ficha ordinaria aporta dos puertos, cada chancho especial aporta dos adicionales y cada conexión ocupa dos puertos. Con `p` colocaciones, `p-1` conexiones y `s` chanchos especiales, la cantidad de destinos abiertos es exactamente:

```text
(2p + 2s) - 2(p - 1) = 2 + 2s
```

Aquí “destino abierto” significa un puerto libre legalmente prolongable: extremo principal, origen lateral libre o terminal de rama. No significa término de puntuación. Como `s ≤ effectiveK = min(K,7)`, el límite estructural global es 16. La expresión `2 + 2K ≤ 16` no es correcta para el K reglamentario cuando `K > 7`; la forma correcta es `2 + 2s ≤ 2 + 2·effectiveK ≤ 16`. El máximo es alcanzable con los siete chanchos especiales en la línea principal.

Para un mismo valor `v`, el límite de diseño es ocho destinos abiertos simultáneos:

- existen seis fichas no dobles incidentes en `v`, cada una con un solo puerto de valor `v`;
- el chancho especial `v|v` dispone de cuatro puertos de valor `v`;
- si ese chancho está conectado al resto del tablero, cada conexión consume un puerto suyo y el puerto `v` de una de las seis fichas incidentes;
- con una conexión, el máximo es `(4 - 1) + (6 - 1) = 8`; con más conexiones disminuye;
- si el chancho es la única ficha, solo presenta cuatro destinos.

El límite ocho puede alcanzarse con K suficiente usando el chancho `v|v` con una conexión —tres puertos libres— y dejando otros cinco dominós incidentes en `v` como terminales de cadenas diferentes. El Bloque 2 conserva una construcción ejecutable que demuestra simultáneamente ocho destinos de un valor y 16 globales. Ninguno de esos ocho destinos implica ocho términos `v` en S.

## Opciones visuales para extremos repetidos

| Criterio | A — Curvas o segmentos | B — Puntos o indicadores | C — `5 × 3` | D — Híbrida |
| --- | --- | --- | --- | --- |
| Comprensión inicial | Alta: sugiere continuidad | Media | Media-baja | Alta si mantiene una metáfora estable |
| Identidad individual | Natural | Posible, menos expresiva | Insuficiente por sí sola | Natural con expansión adaptativa |
| Estética | Orgánica, pero puede cruzar aristas | Limpia y neutral | Muy compacta | Equilibrada, requiere reglas visuales |
| Tacto | Buena con hit areas amplias | Buena si los puntos no son pequeños | Mala para escoger un destino concreto | Mejor al desplegar destinos densos |
| Mouse | Muy buena | Buena | Requiere menú secundario | Muy buena |
| Escalabilidad hasta 8 | Riesgo de saturación | Mejor densidad | Excelente como resumen | Mejor compromiso |
| Accesibilidad | Requiere etiquetas y foco visibles | Igual | Texto legible, pero pierde destinos | Permite texto redundante y objetivos individuales |
| Animación | Muy natural | Natural | Limitada | Natural y adaptable |

### A — Curvas o segmentos salientes

Es la mejor metáfora primaria: cada continuación se percibe como un lugar concreto. Sus riesgos son colisiones, tamaño táctil insuficiente y ruido cuando se concentran muchos extremos.

### B — Puntos alrededor del vértice

Reduce cruces y funciona bien como estado compacto. Un punto aislado comunica peor que existe una cadena que puede continuar, y debe aumentar su área interactiva sin aumentar necesariamente su dibujo.

### C — Multiplicidad textual

Es útil para resumen, fórmula y accesibilidad, pero no permite elegir cuál de tres destinos de valor 5 se desea usar. Nunca debería ser el único control cuando los destinos producen jugadas distintas.

### D — Solución híbrida

Combina segmentos individuales en densidad baja con un contador redundante y una expansión en abanico, anillo o panel cuando el espacio es insuficiente. Mantiene identidad sin obligar a dibujar ocho controles diminutos alrededor del vértice.

## Recomendación de UX

Adoptar la opción D con las curvas de A como lenguaje principal:

1. mostrar un segmento corto por extremo mientras haya espacio legible;
2. añadir `×q` cuando `q > 1` como información redundante, no como sustituto;
3. al seleccionar una ficha, resaltar solo los IDs que forman jugadas legales con ella;
4. si los objetivos se solapan o el dispositivo es táctil, desplegarlos temporalmente en abanico o lista radial;
5. ofrecer navegación de teclado entre objetivos y una descripción accesible con valor, índice y origen;
6. usar pulso o crecimiento discreto y respetar movimiento reducido.

La geometría no debe formar parte de la identidad: reordenar los segmentos alrededor del vértice no puede cambiar el destino elegido.

## Extremos disponibles y suma S

Los destinos legales y los términos de puntuación se derivan del mismo tablero, pero no existe una correspondencia ingenua de “un segmento = N puntos en S”. R-018 y R-033 son la excepción decisiva:

- un chancho ordinario con un único puerto libre puede aportar `2N`;
- un chancho especial puede conservar varios puertos libres y aportar 0 desde su segunda conexión;
- con cero o una conexión, el aporte agregado del chancho es `2N`, no el número de puertos libres multiplicado por N.

La proyección implementada separa:

```js
{
  openEndTargets: [/* dónde se puede jugar */],
  scoringTerms: [/* qué aporta a S y cuánto */],
  sum: 23
}
```

`getScoringProjection(state)` devuelve `{ terms, sum, contributionGroups }`. `terms` proviene directamente de `getScoringTerms`; `sum` suma esas contribuciones y cada grupo usa `{ contribution, count, subtotal }`. No expone una puntuación hipotética por observar el tablero. Ambas colecciones pueden enlazarse mediante `placementId` y, cuando corresponde, `portId`, pero el renderer no recalcula R-018.

Recomendación visual:

- mantener todos los destinos como controles individuales;
- activar un modo de puntuación que ilumine las fuentes que aportan a S;
- mostrar una fórmula lateral, por ejemplo `2·1 + 5·3 + 6·1 = 23`;
- para un chancho, agrupar visualmente sus puertos con una etiqueta única `aporte: 2N` o `aporte: 0`;
- para una jugada ya ocurrida, mostrar puntos consultando `history[].result.scoreAwarded`; observar S actual no finge una acción nueva.

Así, los indicadores ayudan a explicar S sin convertir sus trazos en una segunda implementación de puntuación.

## Grafo final e historial

Al finalizar una ronda, el grafo puede mostrar:

- aristas y lazos jugados, con estilo principal;
- fichas no jugadas, derivadas de las manos finales, como aristas ausentes o atenuadas;
- metadatos de una ficha mediante `dominoId` y `placementId`;
- jugador, turno y `scoreAwarded` consultando la acción `PLAY_DOMINO` correspondiente.

El replay visual puede proyectar prefijos del historial:

```text
G₀ → G₁ → G₂ → … → Gₖ
```

Cada `PLAY_DOMINO` aceptado agrega una única arista o lazo; `PASS` no agrega ninguno. Esta función depende de conservar historial suficiente, pero no exige guardar copias de cada grafo: cada `Gᵢ` es derivable.

`projectGraphView(state, playerId)` compone las consultas pequeñas para entregar vértices, aristas, extremos agrupados, mano, legalidad, puntuación, turno y estado de ronda. En `phase: "finished"` conserva aristas, S, score y una copia de `roundResult`, pero produce `legalPlays: []`. Es una comodidad descartable; los consumidores pueden usar las consultas individuales cuando no necesiten toda la fachada.

## Decisiones todavía abiertas

- layout estable de los siete vértices;
- umbral exacto para pasar de segmentos a expansión híbrida;
- apariencia diferenciada de línea principal y ramas en el grafo de valores;
- representación accesible de destinos que producen el mismo valor pero distinta topología;
- comportamiento de inspección cuando una arista está ausente por permanecer en una mano oculta.

Estas decisiones pertenecen al diseño del renderer y deben validarse con prototipos antes de iniciar su bloque visual.
