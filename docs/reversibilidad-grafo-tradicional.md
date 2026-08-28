# Reversibilidad entre Modo Tradicional y Modo Grafo

## Estado de esta nota

**Problema de diseño en estudio. No autorizado para implementación.**

Esta nota registra una cuestión futura del renderer. No modifica reglas, motor, snapshot, schema, proyecciones existentes ni interfaz. Su objetivo es distinguir qué información se pierde al proyectar el tablero sobre siete valores y evaluar cómo hacer visible la topología tradicional sin convertirla en una segunda fuente de verdad.

## Pregunta central

El GraphRenderer actual responde:

> ¿Qué fichas forman el grafo de valores y dónde puede jugarse?

Una futura inspección topológica debería responder además:

> ¿Cómo están conectadas esas fichas como línea principal y ramas reales de dominó?

Estas preguntas usan el mismo snapshot, pero no la misma cantidad de información visual.

## Tres representaciones distintas

Conviene separar formalmente tres niveles:

1. **Grafo de valores:** vértices `0…6`; cada ficha colocada es una arista o lazo. Colapsa todas las apariciones de un valor en un único vértice.
2. **Topología de colocaciones:** placements individualizados, puertos, conexiones, línea principal ordenada y ramas laterales. Es el tablero lógico reglamentario.
3. **Geometría tradicional:** coordenadas, orientación, giros, espejo y decisiones de trazado de una cadena dibujada. Pertenece exclusivamente al renderer.

La transformación `topología de colocaciones → grafo de valores` pierde información y no es inyectiva. La transformación `topología de colocaciones → geometría tradicional` admite muchas soluciones visuales equivalentes, aunque la secuencia lógica sea única.

## Información que pierde el grafo de valores

Una colección de aristas `{N,M}` y lazos `{N,N}`, incluso enlazada con `placementId`, no expresa por sí sola:

- qué placements son consecutivos en la línea principal;
- cuál de dos conexiones incidentes actúa como predecesora o sucesora en ese recorrido;
- qué placements pertenecen a una rama;
- de qué chancho especial y de qué puerto `branch:*` nace cada rama;
- el orden de los placements dentro de una rama;
- qué puertos concretos están conectados o libres;
- cuál es cada extremo lógico seleccionable;
- qué lado canónico `side:a` o `side:b` participa en una conexión;
- cuál de varias topologías compatibles con las mismas fichas es la vigente.

Los metadatos actuales `playSequence`, `turnNumber` y `playerId` tampoco resuelven esa pérdida. Explican cuándo y por quién apareció una arista, no necesariamente su posición dentro de la cadena final.

## La topología actual sí es reconstruible

El snapshot v6 ya conserva toda la información necesaria para reconstruir la **disposición lógica** de manera unívoca:

- `board.mainLine.placementIds` es el recorrido ordenado de un extremo principal al otro;
- `board.connections` enlaza endpoints exactos `placementId + portId`;
- `getPlacementPorts` relaciona cada puerto ordinario con `side:a` o `side:b` y distingue `main:*` de `branch:*`;
- `board.specialDoublePlacementIds` identifica los únicos orígenes laterales posibles;
- cada rama puede recorrerse desde `branch:1` o `branch:2` mediante `deriveOccupiedBranches`, que ya produce `placementIds` y `connectionIds` ordenados desde la raíz hasta el terminal;
- `placements[placementId].dominoId` recupera los valores de cada ficha.

Por tanto, **no hace falta persistir un orden topológico adicional**. Tampoco hace falta usar el historial para reconstruir el presente. El historial sigue siendo útil para orden cronológico, actor, turno y replay.

Lo que no puede reconstruirse de forma única son coordenadas, giros, elección de arriba/abajo, espejo o quiebres de una representación tradicional. Esas diferencias no son estado reglamentario: son alternativas visuales de una misma topología.

## Tres identidades que no deben mezclarse

| Concepto | Fuente actual | Pregunta que responde |
| --- | --- | --- |
| Orden cronológico | `history[].sequence`, `turn`, `playerId` | ¿Cuándo y quién jugó la ficha? |
| Orden topológico | `mainLine.placementIds` y ramas derivadas | ¿Dónde está dentro de la cadena? |
| Identidad de conexión | `connectionId` y endpoints `placementId + portId` | ¿Qué puertos exactos están unidos? |

Una futura proyección puede reunir los tres para inspección, pero debe conservar campos distintos y nombres inequívocos. Un índice topológico nunca debe llamarse `turn`, `sequence` ni `connectionId`.

## Metadata mínima si solo existiera el grafo de valores

Si se intentara reconstruir el tablero partiendo únicamente de las aristas visuales, habría que añadir como mínimo:

- identidad de placement por arista;
- lista ordenada de placements de la línea principal;
- endpoints por conexión con placement y puerto;
- identificación de los chanchos especiales;
- origen `placementId + branchPortId` y recorrido ordenado de cada rama.

Esa colección reproduce esencialmente el `board` lógico actual. Persistirla junto al grafo duplicaría información y abriría la posibilidad de inconsistencias. La opción preferible para estudiar es una **proyección topológica pura**, derivada y descartable.

## Evaluación de la numeración principal propuesta

La forma:

```text
-p, ..., -2, -1, 1, 2, ..., q
```

puede determinar suficientemente el orden de la línea principal si se fijan además:

1. un `anchorPlacementId` que recibe la etiqueta `1`;
2. qué dirección de `mainLine.placementIds` se considera positiva;
3. que `-1` es el vecino inmediato del ancla por el lado negativo y `2` el vecino inmediato por el positivo.

Tiene una propiedad útil: si el ancla permanece fija, hacer prepend o append no obliga a renumerar placements existentes. Sin esas tres convenciones, las etiquetas son ambiguas: puede elegirse otra ficha de referencia o invertir el recorrido completo.

También presenta una discontinuidad conceptual: el ancla es `1`, sus vecinos son `-1` y `2`, y no existe `0`. Esto no impide reconstruir el orden, pero hace menos natural tratar las etiquetas como distancia.

### Alternativas para comparar

| Alternativa | Ventaja | Riesgo |
| --- | --- | --- |
| Índice `0…n-1` de `mainLine` | Canónico y muy simple | Cambia para todos los elementos cuando se hace prepend |
| Posición `1…n` | Familiar para UI | También cambia al extender por el inicio |
| Offset firmado con ancla en `0` | Distancia natural y estable ante extensiones | Requiere escoger ancla y dirección |
| Propuesta con ancla en `1` y cero omitido | Estable y distingue ambos lados | Convención menos intuitiva y no canónica sin metadata del ancla |
| Vecinos explícitos | No depende de numeración | Menos compacto para mostrar al usuario |

Para una futura proyección interna, el **offset firmado con ancla en `0`** parece más natural que omitir cero. Para una etiqueta visual pueden estudiarse otras formas. Esto es una hipótesis, no una decisión aprobada.

Un ancla candidata es la primera ficha cronológica de la ronda, porque permanece estable mientras la línea crece. Elegirla mezcla deliberadamente una referencia cronológica con una coordenada topológica, por lo que la proyección debería exponer ambos conceptos de forma explícita y no presentarlos como equivalentes.

## Evaluación de coordenadas para ramas

La notación propuesta:

```text
(t,-1), (t,-2), ...
(t, 1), (t, 2), ...
```

es suficiente si:

- `t` identifica sin ambigüedad al chancho raíz;
- se fija de forma permanente qué signo representa `branch:1` y cuál `branch:2`;
- el valor absoluto representa la distancia desde el chancho.

El signo, sin embargo, vuelve a asignar semántica visual izquierda/derecha a puertos que el modelo declaró neutrales. Una forma estructurada aprovecha mejor las identidades existentes:

```js
{
  region: "branch",
  originPlacementId: "placement-17",
  originMainOffset: -2,
  originPortId: "branch:1",
  depth: 3
}
```

`originPlacementId + originPortId` identifica la rama; `depth` ordena sus fichas desde el chancho. `originMainOffset` sería una comodidad visual derivada, no parte de la identidad. Como shorthand de UI todavía podría mostrarse `(t, b, d)` o `(t, ±d)`, pero la proyección no necesita reducir el puerto a un signo.

## Forma conceptual de una proyección futura

Sin fijar todavía una API, una consulta como `getBoardTopologyProjection(state)` podría producir:

```js
{
  mainLine: {
    anchorPlacementId: "placement-1",
    placements: [
      {
        placementId: "placement-8",
        orderIndex: 0,
        signedOffset: -2,
        predecessorPlacementId: null,
        successorPlacementId: "placement-4"
      }
    ]
  },
  branches: [
    {
      originPlacementId: "placement-17",
      originPortId: "branch:1",
      placements: [
        { placementId: "placement-20", depth: 1 },
        { placementId: "placement-24", depth: 2 }
      ]
    }
  ]
}
```

Los nombres y campos son solamente ilustrativos. Antes de implementarla habrá que decidir si conviene exponer offsets, vecinos, conexiones, puertos de entrada/salida o una combinación mínima. La consulta debe derivarse del `board`, ser inmutable y no ser consumida por validadores de legalidad.

## Alternativas visuales futuras

La topología no debería aparecer completa todo el tiempo. En un grafo denso, índices permanentes pueden competir con valores, etiquetas de fichas, curvas y puntuación. Conviene comparar:

1. índices pequeños junto a aristas, activables en un modo de inspección;
2. seleccionar una ficha y mostrar únicamente su posición, vecinos y rama;
3. resaltar temporalmente toda la línea principal o una rama con un recorrido visual;
4. panel lateral “Estructura de la jugada” con secuencia textual;
5. breadcrumbs como `principal −2 → raíz 5|5 → branch:1 → profundidad 3`;
6. alternar entre orden cronológico y topológico con etiquetas claramente distintas;
7. mantener el grafo limpio por defecto y ofrecer la explicación bajo demanda.

La recomendación preliminar es **inspección opcional bajo demanda**, no numeración permanente. Debe probarse antes del refinamiento definitivo.

## Casos que una futura evaluación debe cubrir

- misma colección de fichas con dos topologías lógicas distintas;
- prepend y append de la línea principal sin confundir cronología y posición;
- ancla situada en medio de la línea final;
- chancho especial con cero, una y dos ramas iniciadas;
- ambas ramas del mismo chancho con longitudes diferentes;
- varios chanchos especiales con ramas simultáneas;
- ficha ordinaria y chancho ordinario dentro de una rama;
- reconstrucción de puertos de entrada y salida;
- inversión visual completa de la línea sin cambiar la topología;
- snapshot terminal, donde la inspección continúa disponible;
- pureza, serialización y ausencia de mutación;
- prueba arquitectónica que impida usar esta proyección para legalidad.

## Conclusión provisional

El grafo de valores actual pierde la secuencia tradicional, pero el snapshot reglamentario no la pierde. `mainLine + placements + connections + ports`, junto con ramas derivadas, ya permite reconstruir completamente la topología lógica.

En consecuencia, no se justifica un cambio de schema ni metadata persistida. El problema futuro es diseñar una proyección topológica explicativa y una interacción visual que hagan visible esa información sin sobrecargar el GraphRenderer.
