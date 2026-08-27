# Estrategia y backlog de tests

Los tests usan `node:test`, se ejecutan sin navegador y citan los IDs normativos que verifican. La Fase 1 avanza por bloques; una prueba de un bloque posterior no se adelanta con una implementación ficticia.

## Cobertura ejecutable actual

### Arquitectura y estado base

- importación del motor sin DOM, HTML ni coordenadas;
- tablero vacío conforme al contrato lógico;
- estado v3 serializable, autosuficiente y sin colecciones compartidas;
- ausencia de `stock`, `board.branches` y `placement.region`;
- diagnóstico que distingue capacidades disponibles de mecánicas todavía no implementadas.

### Bloque 1 de Fase 1 — completado

- `tests/model/domino-set.test.js`: R-005, 28 fichas únicas, siete chanchos derivados y rango `0 ≤ a ≤ b ≤ 6`;
- `tests/model/participants.test.js`: R-003/R-004, cardinalidad, pertenencia y alternancia de equipos;
- `tests/rules/seating.test.js`: R-009, sucesor y ciclo antihorario;
- `tests/rules/k-config.test.js`: R-027/DEC-011, dominio de K y `effectiveK` derivado;
- `tests/rules/shuffle.test.js`: R-029, permutación no mutante y fuente inyectable;
- `tests/rules/deal.test.js`: R-006/R-029, cuatro manos disjuntas de siete y reparto reproducible;
- `tests/rules/starting-player.test.js`: R-007, localización de `6-6` en cualquiera de las manos;
- `tests/integration/create-match.test.js`: creación atómica del snapshot v3;
- `tests/integration/initial-snapshot-validation.test.js`: corrupción dirigida de cada invariante inicial requerido.

## Convenciones

- Tests de modelo: forma y material de las entidades.
- Tests de reglas: funciones puras acotadas y enlazadas con `R-nnn`.
- Tests de integración: composición pública y validación cruzada del snapshot.
- La aleatoriedad se sustituye por fuentes controladas; ningún test depende de `Math.random`.

## Backlog de bloques posteriores

### Compatibilidad, elección y tablero

- R-028: igualdad de valores en línea principal, ramas y puertos especiales.
- R-030: enumerar todas las combinaciones legales de ficha y extremo sin selección automática.
- Casos A/B y R-031: crear y extender el camino principal por ambos extremos.
- R-031: rechazar ciclos, duplicados y conexiones principales no consecutivas.

### Chanchos especiales y K efectivo

- R-001/R-002, R-032 y DEC-013: adquisición y persistencia de condición especial.
- Casos C/F/G: capacidad especial, K=0 y K agotado.
- Validar los puertos `main:1`, `main:2`, `branch:1` y `branch:2`.

### Ramificaciones

- Caso D/R-034: iniciar y prolongar una cadena lateral.
- Caso E/R-035: chancho ordinario dentro de rama y prohibición de segundo nivel.
- R-034/R-035: origen único, ramas disjuntas y ausencia de reconexión.

### Turnos, pases y terminación

- R-008/R-010/R-011: elección inicial, una jugada legal o pase solo si corresponde.
- R-012/R-013: contador de pases, reinicio y tranque.
- R-013/R-020: salida, terminación y vencedor tradicional.

### Puntuación y resultado

- R-014 a R-017: cálculo de S, múltiplos de cinco y última jugada.
- Caso H/R-018/R-019/R-033: aporte y capacidad independientes de un chancho.
- R-021 a R-026: tranque, bonificación, marcador final, ganador y empate.
- Coherencia entre `score`, historial y bonificación terminal.

## Pendientes fuera del motor básico

Requerirán especificación propia solo si se incorporan: deshacer acciones, series de varias partidas o meta acumulada, y privacidad/sincronización remota de Fase 6.
