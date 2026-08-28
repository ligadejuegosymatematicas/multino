# Estrategia y backlog de tests

Los tests usan `node:test`, se ejecutan sin navegador y citan los IDs normativos que verifican. La Fase 1 avanza por bloques; una prueba de un bloque posterior no se adelanta con una implementación ficticia.

## Cobertura ejecutable actual

### Arquitectura y estado base

- importación del motor sin DOM, HTML ni coordenadas;
- tablero vacío conforme al contrato lógico;
- estado v6 serializable, autosuficiente y sin colecciones compartidas;
- ausencia de `stock`, `board.branches` y `placement.region`;
- diagnóstico que declara listo el flujo completo de una ronda y mantiene fuera las capacidades futuras.

### Bloque 1 de Fase 1 — completado

- `tests/model/domino-set.test.js`: R-005, 28 fichas únicas, siete chanchos derivados y rango `0 ≤ a ≤ b ≤ 6`;
- `tests/model/participants.test.js`: R-003/R-004, cardinalidad, pertenencia y alternancia de equipos;
- `tests/rules/seating.test.js`: R-009, sucesor y ciclo antihorario;
- `tests/rules/k-config.test.js`: R-027/DEC-011, dominio de K y `effectiveK` derivado;
- `tests/rules/shuffle.test.js`: R-029, permutación no mutante y fuente inyectable;
- `tests/rules/deal.test.js`: R-006/R-029, cuatro manos disjuntas de siete y reparto reproducible;
- `tests/rules/starting-player.test.js`: R-007, localización de `6-6` en cualquiera de las manos;
- `tests/integration/create-match.test.js`: creación atómica del snapshot v6;
- `tests/integration/initial-snapshot-validation.test.js`: corrupción dirigida de cada invariante inicial requerido.

### Bloque 2 de Fase 1 — completado

- `tests/rules/board-contracts.test.js`: puertos canónicos e IDs derivados sin contadores ocultos;
- `tests/integration/board-plays.test.js`: primera ficha, extensión en ambos extremos, compatibilidad e inmutabilidad;
- `tests/integration/board-topology.test.js`: casos normativos A–H, condición especial, ramas y multiplicidad de destinos;
- `tests/rules/open-end-bounds.test.js`: identidad de extremos, fórmula exacta `2 + 2s`, máximo global 16 y construcción con ocho destinos del mismo valor;
- `tests/integration/board-invariants.test.js`: corrupción dirigida de camino principal, puertos, valores, ramas, chanchos, ubicación y K efectivo;
- `tests/integration/board-public-api.test.js`: fachada pública, carga JSON, historial y límite deliberado sin avance de turno ni puntuación.

### Bloque 3 de Fase 1 — completado

- `tests/integration/turn-actions.test.js`: primera acción, jugador actual, acciones disponibles, pase legal/ilegal, avance antihorario, turno, historial e inmutabilidad;
- `tests/integration/round-termination.test.js`: reinicio después de uno, dos o tres pases, cuatro pases exactos, salida, estado terminal y rechazo de acciones posteriores;
- `tests/integration/terminal-snapshot-validation.test.js`: corrupción dirigida de `roundResult`, turno terminal, mano/equipo de salida, tranque e historial `PASS`;
- `tests/fixtures/turn-scenarios.js`: cadenas reglamentarias puntuadas para construir pases, bloqueo y salida sin geometría.

### Bloque 4 de Fase 1 — completado

- `tests/rules/scoring.test.js`: términos ordinarios, R-018 con 0–4 conexiones, fuentes repetidas, separación destinos/términos, suma S y múltiplos de 5;
- `tests/integration/play-scoring.test.js`: primeras jugadas puntuables, asignación por equipo, acumulación `+2/+0/+3`, PASS neutro y última jugada puntuable;
- `tests/integration/scoring-snapshot-validation.test.js`: corrupción de score, equipos, S, puntos, PASS y reconciliación marcador/historial;
- tests anteriores actualizados para schema v5, historial puntuado y readiness parcial explícito.

### Bloque 5 de Fase 1 — completado

- `tests/rules/round-completion.test.js`: suma de valores restantes y redondeo reglamentario de R-023 para residuos 0–4;
- `tests/integration/round-completion.test.js`: salida puntuable/no puntuable, tranque favorable a ambos equipos, igualdad de manos, vencedor tradicional distinto del ganador, empate final y ausencia de evento terminal artificial;
- `tests/integration/terminal-snapshot-validation.test.js`: corrupción de razón, totales restantes, vencedor tradicional, bonificación, marcador final, ganador y empate;
- fixtures terminales construidos desde transiciones reglamentarias y redistribuciones completas de las fichas aún no colocadas;
- tests anteriores sincronizados con schema v6, bonificación terminal y readiness completo de una ronda.

### Fase 2, Bloque 1 — proyección pura de Modo Grafo completada

- `tests/projections/value-graph-projection.test.js`: siete vértices permanentes, aristas, lazos, incidencia, ausencia de paralelas, metadatos temporales y pérdida deliberada de topología;
- `tests/projections/graph-view-projection.test.js`: agrupación e identidad de extremos, destinos por ficha, chancho con puerto libre/aporte 0, explicación de S, snapshot terminal e inmutabilidad;
- `tests/engine-boundaries.test.js` y cobertura específica verifican importación en Node y ausencia de DOM, Canvas, SVG, animaciones o coordenadas en la capa;
- consistencia cruzada con `getOpenEndTargets`, `getLegalPlays` y `getScoringTerms`, sin introducir una segunda lógica reglamentaria.

### Fase 2, Bloque 2 — primer GraphRenderer funcional completado

- `tests/ui/graph-renderer.test.js`: siete vértices SVG, arista, lazo, identidad y multiplicidad de curvas, selección compatible, START separado e inmutabilidad de la proyección;
- `tests/ui/interaction-controller.test.js`: selección de ficha, acción inicial, target exacto con `placementId + portId`, PASS desde la API, reproyección, último resultado puntuable, terminalidad e inmutabilidad;
- la escena y el markup SVG se prueban como funciones puras; no se añadió JSDOM ni una dependencia destinada a comparar píxeles;
- interacción de mouse/teclado, viewport, foco, ronda completa y lectura terminal se verifican manualmente en navegador local.

### Fase 2, Bloque 3 — primera legibilidad topológica completada

- `tests/projections/topology-projection.test.js`: línea/rama, orden, raíz, profundidad, chancho especial, ordinario por K agotado, ordinario lateral, resumen efectivo e inmutabilidad;
- `tests/ui/graph-renderer.test.js`: clases permanentes, distintivo especial, `s/effectiveK`, resaltado de estructura, raíz lateral, inspector de los tres roles de chancho y escenario denso con 18 fichas/16 targets;
- `tests/ui/interaction-controller.test.js`: inspección efímera alternable, rechazo de placements inexistentes y limpieza tras una acción sin contaminar el snapshot;
- CSS y leyenda se verifican para asegurar patrones/etiquetas además del color; botón y `Escape` se comprobaron manualmente en navegador local.

## Convenciones

- Tests de modelo: forma y material de las entidades.
- Tests de reglas: funciones puras acotadas y enlazadas con `R-nnn`.
- Tests de integración: composición pública y validación cruzada del snapshot.
- La aleatoriedad se sustituye por fuentes controladas; ningún test depende de `Math.random`.

## Pendientes fuera del motor básico

Requerirán especificación propia solo si se incorporan: deshacer acciones, series de varias rondas o meta acumulada, variantes `n ≠ 5`, Modo Tradicional, refinamiento premium y privacidad/sincronización remota de Fase 6.
