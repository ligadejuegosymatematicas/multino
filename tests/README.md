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
- `tests/rules/round-structure-mode.test.js`: modos públicos Ramificado/Lineal y codificación interna v6;
- `tests/rules/structural-modes.test.js`: primer doble ramificador, dobles posteriores ordinarios, ronda Lineal completa y proyección estratégica por valor;
- `tests/rules/shuffle.test.js`: R-029, permutación no mutante y fuente inyectable;
- `tests/rules/deal.test.js`: R-006/R-029, cuatro manos disjuntas de siete y reparto reproducible;
- `tests/rules/starting-player.test.js`: R-007, localización de `6-6` en cualquiera de las manos;
- `tests/integration/create-match.test.js`: creación atómica del snapshot v6;
- `tests/integration/initial-snapshot-validation.test.js`: corrupción dirigida de cada invariante inicial requerido.

### Bloque 2 de Fase 1 — completado

- `tests/rules/board-contracts.test.js`: puertos canónicos e IDs derivados sin contadores ocultos;
- `tests/integration/board-plays.test.js`: primera ficha, extensión en ambos extremos, compatibilidad e inmutabilidad;
- `tests/integration/board-topology.test.js`: casos normativos A–H, condición especial, ramas y multiplicidad de destinos;
- `tests/rules/open-end-bounds.test.js`: identidad de extremos, dos destinos en Lineal, cuatro en Ramificado y conservación de cuatro targets concretos del mismo valor;
- `tests/integration/board-invariants.test.js`: corrupción dirigida de camino interno, puertos, valores, brazos, chanchos y ubicación;
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

- `tests/projections/topology-projection.test.js`: recorridos internos, orden, raíz, profundidad, único ramificador, dobles ordinarios e inmutabilidad;
- `tests/ui/graph-renderer.test.js`: resaltado de estructura, raíz, inspector Ramificador/Ordinario y escenario denso bajo la topología vigente;
- `tests/ui/interaction-controller.test.js`: inspección efímera alternable, rechazo de placements inexistentes y limpieza tras una acción sin contaminar el snapshot;
- CSS y leyenda se verifican para asegurar patrones/etiquetas además del color; botón y `Escape` se comprobaron manualmente en navegador local.

### Fase 2, Bloque 4 — identidad y visibilidad de extremos completada

- `tests/projections/topology-projection.test.js`: identidad `P`, reserva estable `A…N`, asociación a puerto/raíz y propagación a placements y targets sin mutar el snapshot;
- `tests/ui/graph-renderer.test.js`: código compartido por raíz/fichas/terminal, estado neutral visible, jerarquía legal/incompatible, índices bajo selección y etiquetas accesibles;
- el escenario denso comprueba catorce identidades laterales potenciales y dieciséis targets sin perder IDs individuales;
- CSS verifica terminales, patrones y letras redundantes, además de desactivar movimiento cuando el usuario lo solicita.

### Fase 2, Bloque 5 — simplificación y familias visuales completada

- `tests/projections/topology-projection.test.js`: los puertos internos conservan IDs exactos, el único ramificador expone dos brazos laterales y los chanchos posteriores no originan familias.
- `tests/ui/graph-renderer.test.js`: elimina etiquetas redundantes de aristas/lazos y letras interiores, reserva números para elecciones múltiples, distingue brazos potenciales/iniciados, inspecciona ambos brazos y raíz, y conserva hit areas táctiles y reglas responsivas.
- Los escenarios Ramificado y Lineal cubren cuatro/dos extremos, ambos brazos, dobles posteriores y grafo denso. La gramática combina trazo, estado de relleno y acento; nunca depende solo del color.

### Fase 2, Bloque 6 — primer Modo Tradicional y conmutador completados

- `tests/projections/traditional-view-projection.test.js`: orden y orientación lógica del recorrido interno, ambos brazos raíz→terminal, dobles ordinarios posteriores, targets exactos, terminalidad, inmutabilidad y ausencia de geometría/DOM;
- `tests/ui/traditional-renderer.test.js`: layout horizontal/vertical inicial, fichas de puntos, cruce especial, extremos compatibles, START, target canónico, estado terminado, responsive y accesibilidad;
- equivalencia directa de mano, jugadas legales, S, turno y resultado entre `projectGraphView` y `projectTraditionalView`;
- `ViewModeController` se prueba como preferencia efímera y el cambio repetido conserva snapshot y selección local.
- `tests/ui/interaction-controller.test.js`: la inspección puede comenzar desde una familia visual y sigue siendo estado efímero ajeno al snapshot; cualquier acción aceptada la limpia.

### Fase 2, Bloque 7 — orientación, simplificación y cámara completadas

- `tests/projections/traditional-view-projection.test.js`: cada brazo expone su puerto/valor de origen además de la cadena ordenada, sin geometría ni persistencia nueva;
- `tests/ui/traditional-renderer.test.js`: fichas asimétricas por ambos extremos principales, brazo superior/inferior, cadena lateral, doble ordinario y dos especiales; cada unión comprueba ambas caras contra el valor lógico;
- la mesa en reposo rechaza códigos estructurales, contadores técnicos, `×4`, familias cromáticas y valores dentro de grandes objetivos; los índices existen solo durante una selección ambigua;
- la cámara pura cubre ajuste de escritorio y límite mínimo legible en teléfono/estado denso; CSS y renderer cubren viewport interno, tacto, arrastre, recentrado y movimiento reducido;
- `tests/ui/graph-renderer.test.js` conserva trazo principal/segmentado, targets y familias, pero verifica la ausencia del símbolo especial y de indicadores de brazos redundantes.

### Fase 2, Bloque 8 — configuración y nueva partida independiente completadas

- `tests/ui/local-game-session-controller.test.js`: pantalla previa sin reparto, Ramificado/Lineal, vista inicial y cambio de vista sin mutar modo ni snapshot;
- ciclo real hasta `finished` seguido de «Jugar otra», con nueva fuente de shuffle, manos de siete, tablero/historial vacíos, score 0–0 y ausencia de resultado, selección e inspección anteriores;
- «Cambiar configuración» descarta la ronda terminal y permite elegir otro modo/vista sin introducir RoundState, MatchState ni divisor editable;
- el HTML expone únicamente la configuración autorizada y las dos acciones terminales, sin dependencias ni DOM artificial en la suite.

### Fase 2, Bloque 9 — jerarquía y feedback general completados

- `tests/ui/game-presentation.test.js`: feedback derivado de puntos y apertura de rama, neutralidad de PASS, orden tablero → mano → secundarios, cabecera/contadores compactos y ausencia de reglas en la entrada web;
- `tests/ui/graph-renderer.test.js`: el modo estructural se proyecta sin añadir un resumen técnico permanente al SVG;
- `tests/ui/traditional-renderer.test.js`: el ajuste conserva el nuevo mínimo legible y el viewport interno en estados que exceden la cámara;
- CSS comprueba cuatro fichas por fila en teléfono, cuadrícula tradicional atenuada, objetivos táctiles y desactivación de feedback animado con `prefers-reduced-motion`.

### Fase 2, Bloque 10 — escala, capas y mano compacta completados

- `tests/ui/graph-renderer.test.js`: la geometría ancha conserva los siete valores y expande materialmente su ocupación horizontal; el SVG deriva la órbita de la escena.
- `tests/ui/traditional-renderer.test.js`: cada segmento comienza y termina en la cara física proyectada, la cámara amplía contenido holgado y mantiene el mínimo legible en estados densos.
- `tests/ui/game-presentation.test.js`: verifica el orden de capas, la cuadrícula secundaria, mini-fichas con puntos compartidos, ausencia del rótulo visible de destino único y eliminación de mensajes de vista redundantes.
- La revisión manual cubre 1366×768 y 390×844 a 100%, estado temprano y estado de 22 fichas; ambos modos evitan overflow horizontal de página y Tradicional conserva pan interno en densidad alta.

### Fase 2, Bloque 11 — presentación de puntuación y privacidad local completados

- `tests/projections/scoring-presentation.test.js`: política/divisor únicos, término agrupado de chancho, jugada múltiplo/no múltiplo, puerto libre con aporte 0 y contrato futuro deshabilitado sin activar una variante;
- `tests/ui/game-presentation.test.js`: feedback puntuable desde la proyección, jerarquía terminal con ganador final prioritario y empate explícito;
- `tests/ui/graph-renderer.test.js` y `tests/ui/traditional-renderer.test.js`: resaltado de fuentes reales de S, geometría ancha menos plana, sockets integrados y ajuste final de mesa completa;
- `tests/ui/local-game-session-controller.test.js`: barrera de privacidad, revelación inmutable, ocultamiento en el cambio de turno/renderer y limpieza al volver a jugar;
- los renderers no codifican el divisor ni derivan S desde objetivos abiertos; `prefers-reduced-motion` conserva la información sin pulsos.

### Fase 2, Bloque 12 — legibilidad estratégica y prioridad tradicional completadas

- `tests/projections/strategic-target-projection.test.js`: simulación pura por target mediante la transición reglamentaria, correspondencia exacta de S/puntos, targets repetidos, principal/brazos, términos agrupados e inmutabilidad;
- `tests/ui/traditional-renderer.test.js`: margen geométrico de conexiones, hit areas y puentes respecto del interior de cada ficha, además de selección exacta sin revelar puntuación futura;
- `tests/ui/graph-renderer.test.js`: extremos protagonistas, familias terminales atenuadas e inexistencia de adelantos de S/puntos en la selección normal;
- `tests/ui/local-game-session-controller.test.js`: Tradicional como preferencia inicial y Grafo disponible sin mutar modo ni snapshot.

### Fase 2, Bloque 13 — vista experimental Puertos completada

- `tests/projections/port-graph-projection.test.js`: siete macro-nodos, 42 puertos deterministas, hilos, puentes, fixture de doce fichas con visitas repetidas, extremos exactos, dobles ordinarios/especiales y ramas;
- `tests/ui/port-renderer.test.js`: geometrías compacta/ancha, SVG separado de reglas, hubs, targets repetidos, inspección de principal/rama/macro-nodo, terminalidad y ausencia de IDs técnicos visibles;
- `tests/ui/interaction-controller.test.js` y `tests/ui/local-game-session-controller.test.js`: proyección integrada, privacidad y conmutación Tradicional ↔ Puertos ↔ Grafo sin mutar snapshot;
- revisión manual en 1366×768 y 390×844: siete valores únicos, extremos visibles, foco por rama/nodo, feedback compartido, estado terminal, sin overflow ni errores de consola;
- limitación honesta: una mesa casi completa con varios recorridos cruzados no se sigue globalmente de un vistazo en 390 px; la inspección local es necesaria y el prototipo no reduce los nodos a una escala ilegible.

### Fase 2, Bloque 14 — Puertos v2 completado

- `tests/ui/port-renderer.test.js`: rutas Bézier anulares, estados de reposo/decisión/inspección, brazo exacto sin mezclar su gemelo, raíz única con varios especiales, lente de seis incidencias y separación de marcas primarias/secundarias;
- `analyzePortSceneDensity` mide hilos, cruces geométricos estimados, puentes, hubs, ramas, extremos y carga primaria/secundaria sin convertir esas métricas en reglas;
- CSS verifica puertos potenciales secundarios, recorridos vivos, lente local y `prefers-reduced-motion`; los targets canónicos y el fixture de doce fichas conservan su cobertura anterior;
- revisión manual en 1366×768 y 390×844 cubre reposo denso, selección, ruta principal/brazo, hub especial, apertura local, puntuación compartida y ausencia de overflow global;
- las mediciones históricas de densidad se conservan como registro de diseño; el contrato vigente prueba Ramificado/Lineal.

### Fase 2, Bloque 15 — Puertos v3 game-first completado

- `tests/ui/port-renderer.test.js`: tapa cerrada por defecto, ausencia de hilos/puentes completos y 42 puertos potenciales en Jugar, colas para targets reales, decisión exacta, recorrido aislado y restauración completa en Ver estructura;
- la escena conserva toda la información matemática mientras el SVG aplica revelado progresivo; los cuatro niveles y el foco de nodo no mutan el snapshot;
- abrir el saco mantiene seis incidencias y hubs ordinario/especial, oculta notación técnica y presenta un único cierre visible más `Escape`;
- el feedback de la tapa usa exclusivamente `scoringPresentation`, distingue targets de términos y omite la explicación cuando el contrato está deshabilitado;
- `tests/ui/game-presentation.test.js` cubre HUD móvil en una fila, eliminación de acción/cero pases, handoff compacto, PASS contextual y proximidad tablero → mano;
- revisión visual en 1366×768 y 390×844 cubre Jugar, selección, recorrido, estructura, saco, scoring, privacidad, terminalidad y ausencia de overflow global.

## Convenciones

- Tests de modelo: forma y material de las entidades.
- Tests de reglas: funciones puras acotadas y enlazadas con `R-nnn`.
- Tests de integración: composición pública y validación cruzada del snapshot.
- La aleatoriedad se sustituye por fuentes controladas; ningún test depende de `Math.random`.

## Pendientes fuera del motor básico

Requerirán especificación propia solo si se incorporan: deshacer acciones, series de varias rondas o meta acumulada, variantes `n ≠ 5`, refinamiento premium y privacidad/sincronización remota de Fase 6.
