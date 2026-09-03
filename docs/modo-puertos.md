# Vista experimental Puertos

## Propósito

Puertos es una representación intermedia entre la mesa topológica completa y el grafo simple de valores. Mantiene exactamente siete macro-nodos y conserva qué incidencias continúan entre sí. Es una proyección descartable para UI: no es fuente de verdad, no valida jugadas y no añade campos al snapshot v6.

```text
board lógico
    │
    ▼
PortGraphProjection
    │
    ▼
PortScene (geometría descartable)
    │
    ▼
PortRenderer (SVG e intención del usuario)
```

## Definición implementada

Para cada `n ∈ {0,…,6}` existe un único macro-nodo `B_n`. Contiene los seis puertos ordinarios:

```text
p(n→m), con m ∈ {0,…,6} y m ≠ n
```

El ID derivado es estable y no depende del turno. Una ficha no doble `[n|m]` colocada se proyecta como un hilo exterior que une `p(n→m)` con `p(m→n)`. La ficha conserva `dominoId`, `placementId`, región y metadata temporal derivada.

Una conexión del board que continúa por el valor `n` se proyecta dentro de `B_n` como puente entre sus dos endpoints reales. Un endpoint puede ser un puerto ordinario o un socket de doble. Dos pasos diferentes por el mismo `B_n` conservan `connectionId` y parejas diferentes, por lo que no se mezclan.

## Dobles

El doble `[n|n]` es un hub interno asociado a `B_n`; nunca crea otro nodo ni ocupa un puerto `p(n→m)`.

- ordinario: dos sockets derivados de `side:a` y `side:b`;
- especial de línea principal: cuatro sockets derivados de `main:1`, `main:2`, `branch:1` y `branch:2`.

Los nombres internos solo mantienen identidad para el motor y la acción. La UI describe esos sockets como extremos principales, laterales u ordinarios y no filtra IDs técnicos.

## Extremos e interacción

Los 42 puertos ordinarios potenciales se dibujan discretamente, pero solo una incidencia de ficha ya colocada incluida en `getOpenEndTargets` se convierte en extremo vivo. Los targets conservan `placementId + portId`; varios extremos del mismo valor siguen siendo controles separados y reciben números únicamente cuando una selección necesita desambiguarlos.

Sin ficha seleccionada, los extremos reales tienen halo y área táctil. Con selección, los compatibles ganan énfasis y los incompatibles se atenúan. `START`, `PASS`, cierre, privacidad local y feedback posterior se comparten con las otras vistas mediante `InteractionController` y `projectRoundView`.

Puertos no calcula S desde incidencias ni extremos. El feedback utiliza `scoringPresentation`, basado en `scoringTerms`, de modo que un doble con socket libre y contribución cero se representa correctamente.

## Línea principal y ramas

Principal y ramas se clasifican desde la topología existente. La principal usa hilo continuo; las ramas, trazo segmentado y un acento sobrio de familia. Inspeccionar una estructura resalta sus hilos, puentes, raíz y extremos, y atenúa lo ajeno. Una rama que vuelve a visitar un valor ya usado por la principal reutiliza el mismo `B_n`, pero con otra pareja de incidencias.

La densidad interior se resuelve bajo demanda mediante «abrir el saco»: el detalle local enumera todas las parejas de incidencias y hubs de un valor sin duplicar el macro-nodo. Es accesible por tacto, mouse, teclado y `Escape`.

## Fixture de continuidad

El fixture sin dobles:

```text
6–1–4–0–2–5–3–1–2–4–6–0–5
```

produce doce hilos y once puentes. En `B_1`, por ejemplo, los pasos `6–1–4` y `3–1–2` generan parejas interiores distintas. Recorrer hilo → puente → hilo recupera toda la secuencia sin crear copias de 1, 2, 4 o cualquier otro valor.

## Responsive y limitación observada

Las geometrías compacta y ancha conservan un heptágono reconocible, targets táctiles y ausencia de overflow horizontal global. En 1366×768 se distinguen nodos, hubs, extremos y recorridos inspeccionados con claridad razonable.

En 390×844 los siete nodos y targets permanecen utilizables. Sin embargo, una mesa casi completa con varias ramas acumula muchos hilos cruzados y no permite seguir globalmente cada recorrido de una sola mirada. La inspección de rama y el detalle local del macro-nodo son necesarios. Esta es una limitación honesta del prototipo y una cuestión de evaluación de producto, no un motivo para persistir geometría ni reducir todo hasta volverlo ilegible.

## Comparación

- frente a Tradicional, Puertos sacrifica continuidad espacial inmediata a cambio de agrupar incidencias por valor;
- frente a Grafo, conserva qué entrada continúa con qué salida y representa dobles como hubs explícitos;
- Tradicional sigue siendo la vista inicial; Puertos sigue experimental; Grafo conserva su papel analítico.
