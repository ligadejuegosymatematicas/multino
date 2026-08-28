# Estrategia y backlog de tests

Los tests usan `node:test`, se ejecutan sin navegador y citan los IDs normativos que verifican. La Fase 1 avanza por bloques; una prueba de un bloque posterior no se adelanta con una implementación ficticia.

## Cobertura ejecutable actual

### Arquitectura y estado base

- importación del motor sin DOM, HTML ni coordenadas;
- tablero vacío conforme al contrato lógico;
- estado v5 serializable, autosuficiente y sin colecciones compartidas;
- ausencia de `stock`, `board.branches` y `placement.region`;
- diagnóstico que distingue inicialización, tablero lógico disponible y mecánicas todavía no implementadas.

### Bloque 1 de Fase 1 — completado

- `tests/model/domino-set.test.js`: R-005, 28 fichas únicas, siete chanchos derivados y rango `0 ≤ a ≤ b ≤ 6`;
- `tests/model/participants.test.js`: R-003/R-004, cardinalidad, pertenencia y alternancia de equipos;
- `tests/rules/seating.test.js`: R-009, sucesor y ciclo antihorario;
- `tests/rules/k-config.test.js`: R-027/DEC-011, dominio de K y `effectiveK` derivado;
- `tests/rules/shuffle.test.js`: R-029, permutación no mutante y fuente inyectable;
- `tests/rules/deal.test.js`: R-006/R-029, cuatro manos disjuntas de siete y reparto reproducible;
- `tests/rules/starting-player.test.js`: R-007, localización de `6-6` en cualquiera de las manos;
- `tests/integration/create-match.test.js`: creación atómica del snapshot v5;
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

## Convenciones

- Tests de modelo: forma y material de las entidades.
- Tests de reglas: funciones puras acotadas y enlazadas con `R-nnn`.
- Tests de integración: composición pública y validación cruzada del snapshot.
- La aleatoriedad se sustituye por fuentes controladas; ningún test depende de `Math.random`.

## Backlog de bloques posteriores

### Finalización y bonificación

- R-020 a R-026: vencedor tradicional, bonificación, marcador final, ganador y empate.
- suma de valores restantes y coherencia entre puntos por jugada, bonificación e historial terminal.

## Pendientes fuera del motor básico

Requerirán especificación propia solo si se incorporan: deshacer acciones, series de varias partidas o meta acumulada, y privacidad/sincronización remota de Fase 6.
