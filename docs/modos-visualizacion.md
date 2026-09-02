# Modos de visualización

## Estado de este documento

Este documento describe la arquitectura de presentación implementada y sus extensiones futuras. No modifica `REGLAS.md` ni añade modalidades reglamentarias.

## Un estado, dos vistas

La partida debe poder representarse al menos de estas dos formas:

- **Modo Tradicional:** vista inicial de juego, con mesa, fichas físicas, mano, línea principal y ramificaciones.
- **Modo Grafo:** vista secundaria analítica, centrada en los valores `0` a `6`, las fichas jugadas como aristas o lazos y los extremos abiertos individualizados.

Ambas vistas reciben el mismo snapshot lógico y deben permitir alternar durante una partida sin aplicar ninguna acción de dominio:

```text
                    MOTOR
                      │
               snapshot lógico
                      │
              proyección de vista
                      │
            ┌─────────┴─────────┐
            │                   │
            ▼                   ▼
      GraphRenderer      TraditionalRenderer
```

Cambiar de renderer no baraja, reparte, juega, pasa, puntúa ni modifica el turno. La preferencia visual pertenece a UI o configuración local del usuario, no a `config` reglamentaria ni al snapshot v6.

## Configuración de partida y representación

| Configuración de partida | Representación |
| --- | --- |
| sistema de puntuación aprobado | Modo Grafo |
| topología y K | Modo Tradicional |
| condición de victoria | zoom y layout |
| participantes y equipos | animaciones y preferencias visuales |

Las columnas son independientes. Una vista no puede consultar su propio estado visual para resolver una regla.

## Contrato implementado de proyección

Los renderers no deben recorrer estructuras internas de forma distinta ni reinterpretar reglas. La capa `src/js/game/projections/` ofrece consultas pequeñas y una fachada compuesta:

```js
{
  vertices: [],
  edges: [],
  openEndsByValue: [],
  hand: [],
  legalPlays: [],
  scoring: {
    terms: [],
    sum: 0,
    contributionGroups: []
  },
  turn: {},
  roundStatus: {}
}
```

`projectRoundView(state, playerId)` compone la información compartida. `projectGraphView` añade valores, aristas y topología; `projectTraditionalView` añade una mesa lógica con línea principal y familias de dos brazos. `getValueGraphProjection`, `getTraditionalBoardProjection`, `groupOpenEndsByValue`, `getLegalTargetsForDomino` y `getScoringProjection` permiten consumir solo una parte. `getStrategicTargetProjections` anticipa por target exacto las consecuencias de aplicar una acción reglamentaria, pero no se consulta desde la presentación normal para no revelar S ni puntos futuros. Todos los objetos son derivados y descartables; no se añaden al snapshot. El motor sigue siendo la autoridad sobre extremos, legalidad, S y puntuación. Cada renderer solo decide geometría, estilo, foco y desplazamiento.

## Responsabilidades comunes

### Motor y proyecciones puras

- validar y aplicar acciones;
- identificar cada destino abierto mediante referencias lógicas;
- enumerar todas las jugadas legales;
- calcular S y el resultado de puntuación cuando corresponda;
- no producir coordenadas, curvas, colores ni rotaciones.

### Renderer

- convertir IDs y relaciones lógicas en geometría;
- mantener hit-testing y foco asociados a IDs de dominio;
- emitir una intención de usuario, nunca mutar el snapshot;
- poder descartarse y reconstruirse por completo desde el mismo estado;
- respetar preferencias de movimiento reducido, contraste y tamaño táctil.

### Controlador de interacción

- conservar la selección visual actual;
- solicitar al motor las jugadas legales;
- traducir la elección de un destino visual a una acción con un extremo lógico concreto;
- entregar al renderer el snapshot aceptado posterior.

## Modos funcionales y conmutador

La configuración propone TraditionalRenderer como vista inicial y conserva el conmutador `Grafo | Tradicional`. El TraditionalRenderer usa una línea principal predominantemente horizontal y coloca los brazos `branch:1`/`branch:2` por encima/debajo de cada raíz especial. La mitad orientada hacia su predecesora proviene del puerto real de conexión: el brazo superior invierte el orden visual raíz→terminal y el inferior lo conserva. La selección de ficha se conserva al alternar; la vista se reconstruye desde las proyecciones del mismo snapshot y no emite una acción de dominio.

En Tradicional, la geometría comunica la estructura: no se muestran permanentemente `P/A`, familias, K ni IDs. Los extremos libres son sockets próximos a la mitad abierta; la selección resalta compatibles y solo numera opciones concretas repetidas. Una cámara local ajusta y centra el contenido sin cruzar un tamaño mínimo legible; si la mesa sigue siendo mayor, se recorre dentro de su viewport mediante tacto o arrastre, sin desplazar horizontalmente la página.

La interfaz compartida usa una jerarquía tablero → mano → cantidades. Turno, marcador y S forman una banda compacta; K es un dato secundario de sesión. Los puntos obtenidos, el nuevo turno y la apertura de un brazo reciben feedback efímero derivado del último evento y su proyección topológica. El cambio de renderer no repite dicho feedback ni altera la partida.

La diferencia entre reconstruir la topología lógica y escoger una geometría tradicional está analizada en [`reversibilidad-grafo-tradicional.md`](reversibilidad-grafo-tradicional.md). `getTraditionalBoardProjection` confirma la conclusión: la topología es unívoca y la geometría es una decisión descartable, sin metadata persistida.

Conviene conservar la última preferencia de vista como ajuste local del usuario. No debe viajar dentro de un snapshot autoritativo ni producir diferencias en replay.

## Accesibilidad e interacción

- Los objetivos deben ser alcanzables con mouse, tacto y teclado.
- Cada objetivo necesita nombre accesible, por ejemplo: “Extremo 2 de 3, valor 5, ramificación de 4–4”.
- El color y la animación no pueden ser la única señal de legalidad o selección.
- El foco debe permanecer asociado al ID lógico aunque el layout se recalcule.
- Las animaciones de pulso deben desactivarse con `prefers-reduced-motion`.

## No implementado

Permanecen pendientes acabado premium, giros físicos de cadenas largas, zoom gestual, gestión avanzada de densidad, replay, animaciones complejas y controles definitivos. Ambos renderers actuales son deliberadamente prototipos funcionales.
