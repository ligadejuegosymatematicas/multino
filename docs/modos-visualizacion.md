# Modos de visualización

## Estado de este documento

Este documento define arquitectura de presentación y decisiones de producto futuras. No modifica `REGLAS.md`, no añade modalidades reglamentarias y no implementa renderers.

## Un estado, dos vistas

La partida debe poder representarse al menos de estas dos formas:

- **Modo Grafo:** vista predeterminada prevista, centrada en los valores `0` a `6`, las fichas jugadas como aristas o lazos y los extremos abiertos individualizados.
- **Modo Tradicional:** mesa, fichas físicas, mano, línea principal y ramificaciones.

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

`projectGraphView(state, playerId)` compone esa forma; `getValueGraphProjection`, `groupOpenEndsByValue`, `getOpenEndVisualProjection`, `getLegalPlayProjection`, `getLegalTargetsForDomino` y `getScoringProjection` permiten consumir solo una parte. Todos los objetos son derivados y descartables; no se añaden al snapshot. El motor sigue siendo la autoridad sobre extremos, legalidad, S y puntuación. El renderer solo decidirá geometría, estilo, foco y animación.

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

## Modo Grafo predeterminado

La preferencia actual de producto es abrir una partida en Modo Grafo. Esta elección no convierte el grafo de valores en estado normativo ni elimina el Modo Tradicional. Debe existir una opción visible para alternar de vista y cada renderer debe reconstruirse sin pérdida de información.

Conviene conservar la última preferencia de vista como ajuste local del usuario. No debe viajar dentro de un snapshot autoritativo ni producir diferencias en replay.

## Accesibilidad e interacción

- Los objetivos deben ser alcanzables con mouse, tacto y teclado.
- Cada objetivo necesita nombre accesible, por ejemplo: “Extremo 2 de 3, valor 5, ramificación de 4–4”.
- El color y la animación no pueden ser la única señal de legalidad o selección.
- El foco debe permanecer asociado al ID lógico aunque el layout se recalcule.
- Las animaciones de pulso deben desactivarse con `prefers-reduced-motion`.

## No implementado

Permanecen pendientes GraphRenderer, TraditionalRenderer, selector de vista, geometría, SVG/Canvas, curvas reales, animaciones y controles definitivos. La capa pura no autoriza por sí sola ninguno de esos bloques visuales.
