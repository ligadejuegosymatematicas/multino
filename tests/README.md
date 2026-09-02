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

### Fase 2, Bloque 4 — identidad y visibilidad de extremos completada

- `tests/projections/topology-projection.test.js`: identidad `P`, reserva estable `A…N`, asociación a puerto/raíz y propagación a placements y targets sin mutar el snapshot;
- `tests/ui/graph-renderer.test.js`: código compartido por raíz/fichas/terminal, estado neutral visible, jerarquía legal/incompatible, índices bajo selección y etiquetas accesibles;
- el escenario denso comprueba catorce identidades laterales potenciales y dieciséis targets sin perder IDs individuales;
- CSS verifica terminales, patrones y letras redundantes, además de desactivar movimiento cuando el usuario lo solicita.

### Fase 2, Bloque 5 — simplificación y familias visuales completada

- `tests/projections/topology-projection.test.js`: ambos extremos principales usan `P`; los puertos `branch:1` y `branch:2` conservan IDs exactos pero comparten una familia por chancho especial; un segundo especial recibe `B`; chanchos ordinarios por K o por rama no originan familias.
- `tests/ui/graph-renderer.test.js`: elimina etiquetas redundantes de aristas/lazos y letras interiores, reserva números para elecciones múltiples, distingue brazos potenciales/iniciados, inspecciona ambos brazos y raíz, y conserva hit areas táctiles y reglas responsivas.
- Los escenarios K=1, K=2 y K=7 cubren agotamiento, dos brazos de una familia, segunda familia y grafo denso. La gramática combina trazo, letra, estado de relleno y acento; nunca depende solo del color.

### Fase 2, Bloque 6 — primer Modo Tradicional y conmutador completados

- `tests/projections/traditional-view-projection.test.js`: orden y orientación lógica de `mainLine`, ambos brazos raíz→terminal, dobles ordinarios en rama/principal por K, targets exactos, terminalidad, inmutabilidad y ausencia de geometría/DOM;
- `tests/ui/traditional-renderer.test.js`: layout horizontal/vertical inicial, fichas de puntos, cruce especial, extremos compatibles, START, target canónico, estado terminado, responsive y accesibilidad;
- equivalencia directa de mano, jugadas legales, S, turno y resultado entre `projectGraphView` y `projectTraditionalView`;
- `ViewModeController` se prueba como preferencia efímera y el cambio repetido conserva snapshot y selección local.
- `tests/ui/interaction-controller.test.js`: la inspección puede comenzar desde una familia visual y sigue siendo estado efímero ajeno al snapshot; cualquier acción aceptada la limpia.

### Fase 2, Bloque 7 — orientación, simplificación y cámara completadas

- `tests/projections/traditional-view-projection.test.js`: cada brazo expone su puerto/valor de origen además de la cadena ordenada, sin geometría ni persistencia nueva;
- `tests/ui/traditional-renderer.test.js`: fichas asimétricas por ambos extremos principales, brazo superior/inferior, cadena lateral, doble ordinario y dos especiales; cada unión comprueba ambas caras contra el valor lógico;
- la mesa en reposo rechaza códigos estructurales, resumen de K, `×4`, familias cromáticas y valores dentro de grandes objetivos; los índices existen solo durante una selección ambigua;
- la cámara pura cubre ajuste de escritorio y límite mínimo legible en teléfono/estado denso; CSS y renderer cubren viewport interno, tacto, arrastre, recentrado y movimiento reducido;
- `tests/ui/graph-renderer.test.js` conserva trazo principal/segmentado, targets y familias, pero verifica la ausencia del símbolo especial y de indicadores de brazos redundantes.

### Fase 2, Bloque 8 — configuración y nueva partida independiente completadas

- `tests/ui/local-game-session-controller.test.js`: pantalla previa sin reparto, K=0/1/7, vista inicial Grafo/Tradicional y cambio de vista sin mutar K ni snapshot;
- ciclo real hasta `finished` seguido de «Jugar otra», con nueva fuente de shuffle, manos de siete, tablero/historial vacíos, score 0–0 y ausencia de resultado, selección e inspección anteriores;
- «Cambiar configuración» descarta la ronda terminal y permite elegir otro K/vista sin introducir RoundState, MatchState, divisor editable ni contratos nuevos de motor;
- el HTML expone únicamente la configuración autorizada y las dos acciones terminales, sin dependencias ni DOM artificial en la suite.

### Fase 2, Bloque 9 — jerarquía y feedback general completados

- `tests/ui/game-presentation.test.js`: feedback derivado de puntos y apertura de rama, neutralidad de PASS, orden tablero → mano → secundarios, cabecera/contadores compactos y ausencia de reglas en la entrada web;
- `tests/ui/graph-renderer.test.js`: K efectivo sigue disponible en la escena aunque el resumen redundante ya no se serializa dentro del SVG;
- `tests/ui/traditional-renderer.test.js`: el ajuste conserva el nuevo mínimo legible y el viewport interno en estados que exceden la cámara;
- CSS comprueba cuatro fichas por fila en teléfono, cuadrícula tradicional atenuada, objetivos táctiles y desactivación de feedback animado con `prefers-reduced-motion`.

### Fase 2, Bloque 10 — escala, capas y mano compacta completados

- `tests/ui/graph-renderer.test.js`: la geometría ancha conserva los siete valores y expande materialmente su ocupación horizontal; el SVG deriva la órbita de la escena.
- `tests/ui/traditional-renderer.test.js`: cada segmento comienza y termina en la cara física proyectada, la cámara amplía contenido holgado y mantiene el mínimo legible en estados densos.
- `tests/ui/game-presentation.test.js`: verifica el orden de capas, la cuadrícula secundaria, mini-fichas con puntos compartidos, ausencia del rótulo visible de destino único y eliminación de mensajes de vista redundantes.
- La revisión manual cubre 1366×768 y 390×844 a 100%, estado temprano y estado de 22 fichas; ambos modos evitan overflow horizontal de página y Tradicional conserva pan interno en densidad alta.

## Convenciones

- Tests de modelo: forma y material de las entidades.
- Tests de reglas: funciones puras acotadas y enlazadas con `R-nnn`.
- Tests de integración: composición pública y validación cruzada del snapshot.
- La aleatoriedad se sustituye por fuentes controladas; ningún test depende de `Math.random`.

## Pendientes fuera del motor básico

Requerirán especificación propia solo si se incorporan: deshacer acciones, series de varias rondas o meta acumulada, variantes `n ≠ 5`, refinamiento premium y privacidad/sincronización remota de Fase 6.
