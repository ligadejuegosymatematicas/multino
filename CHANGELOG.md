# Changelog

Todos los cambios relevantes del proyecto se documentan aquí. El formato sigue los principios de *Keep a Changelog* sin asumir todavía una política de versionado de entregas.

## [No publicado]

### Añadido

- Estructura inicial estática compatible con GitHub Pages.
- Documentación normativa, plan por fases y registro de decisiones.
- Propuesta de tablero lógico basado en grafo y puertos.
- Esquema inicial de estado serializable e historial de acciones.
- Fronteras de módulos para motor, UI, persistencia y red futuras.
- Interfaz mínima de diagnóstico sin mecánicas simuladas.
- Infraestructura de tests con `node:test` y pruebas de arquitectura.
- Reglamento consolidado R-003 a R-027 para participantes, material, reparto, turnos, pase, tranque, puntuación y resultado final.
- Casos normativos disponibles y backlog separado por reglas listas o todavía bloqueadas.
- Reglas R-028 a R-035 para compatibilidad, mezcla, elección de jugada, línea principal, puertos especiales y ramificaciones.
- Casos normativos topológicos A–H.
- Primer bloque de Fase 1: catálogo doble-seis, participantes, asientos, K, mezcla, reparto y jugador inicial.
- API pública `createMatch`, funciones puras de preparación y validador del snapshot inicial v3.
- Errores de dominio con códigos estables y detalles útiles para diagnóstico.
- Tests de modelo, reglas e integración para R-003 a R-007, R-009, R-027 y R-029.
- Documentación de Modo Grafo, modos de visualización, variantes futuras y separación conceptual Round/Match.
- Evaluación de extremos repetidos, límites de 16 globales y ocho para un mismo valor, opciones de UX y replay del grafo.
- Matrices de coherencia para `Divisible por n`, `Sin divisibilidad`, condiciones de victoria y participantes alternativos.
- Bloque 2 de Fase 1: tablero lógico ocupado, puertos canónicos, línea principal ordenada, ramas derivadas y chanchos especiales.
- API pública `getOpenEndTargets`, `getLegalPlays`, `applyPlay`, `getDerivedBranches` y `validateBoardState`.
- Historial `PLAY_DOMINO` con IDs secuenciales derivados del snapshot y `connectionId: null` para la primera ficha.
- Tests ejecutables de los casos topológicos A–H, destinos repetidos, máximos de extremos y corrupción controlada de invariantes.
- Bloque 3 de Fase 1: transición reglamentaria `applyTurnAction`, consulta `getAvailableActions` y validador `validateRoundState`.
- Acciones `PASS`, avance antihorario, `turnNumber` secuencial, reinicio de pases y terminación por salida o cuatro pases.
- Snapshot terminal mínimo con `phase: "finished"` y `roundResult` discriminado por `EMPTY_HAND` o `BLOCKED`.
- Estado serializable elevado a schema v4 para formalizar turno reglamentario, historial único y fase terminal.
- Historial canónico de un evento por acción reglamentaria y eventos `PASS` con `payload` y `result` vacíos.
- Tests de integración para turno incorrecto, pase legal/ilegal, bloqueo, salida, inmutabilidad y corrupción terminal.

### Decidido

- Cero dependencias externas en la Fase 0.
- Entrada web en la raíz del repositorio.
- El motor no depende del DOM, CSS, animaciones ni coordenadas.
- `mainLine` es una clasificación lógica; su horizontalidad pertenece al renderer.
- K conserva cualquier entero no negativo configurado y `effectiveK = min(K, 7)` es derivado.
- Las ramificaciones se derivan; la condición especial adquirida se persiste en una única lista ordenada.
- `mainLine.placementIds` representa el recorrido lógico ordenado entre los dos extremos principales.
- Las ramificaciones permanecen derivadas como cadenas laterales sin segundo nivel.
- El snapshot es autosuficiente; `history` sirve para auditoría y replay, no para reconstruir el presente.
- Fisher–Yates no mutante con fuente de aleatoriedad inyectable; el algoritmo es técnico, no normativo.
- Reparto técnico circular de la secuencia mezclada y creación atómica `setup → playing` sin evento histórico artificial.
- DEC-019 a DEC-024: distinguir ambos grafos, renderers intercambiables, extremos derivados dirigibles, configuración separada de vista, Round/Match pospuesto y política de puntuación aislada.
- Modo Grafo previsto como representación predeterminada, con Modo Tradicional disponible sobre el mismo snapshot.
- DEC-025 a DEC-028 resuelven ARQ-PEND-001 a 005: acción discriminada, puertos neutrales, IDs derivados y consultas separadas.
- DEC-029 a DEC-031 separan transición reglamentaria y topológica, formalizan `turnNumber`/estado terminal y fijan la consulta de acciones disponibles.

### Cambiado

- Estado serializable elevado a esquema v2.
- Eliminados del esquema `placement.region`, `board.branches`, `placement.role`, `specialMainLineDoubleIds` y `stock`.
- Documentación de tablero, estado, invariantes, puntuación y modo 2 vs 2 sincronizada con el reglamento aprobado.
- En una revisión intermedia, Fase 0 continuó en curso hasta cerrar compatibilidad, puertos y topologías.
- Estado serializable elevado posteriormente a esquema v3, con `score`, `consecutivePasses` y `specialDoublePlacementIds` persistidos.
- DEC-013 sustituye DEC-010 para persistir la condición especial adquirida.
- DEC-014 sustituye parcialmente DEC-012 para reintroducir el marcador normativo.
- Fase 0 declarada completada documentalmente.
- Fase 1 iniciada de forma autorizada; su bloque inicial queda completado y aprobado sin implementar jugadas, tablero ocupado, puntuación ni terminación.
- Diagnóstico de capacidades y textos mínimos de UI sincronizados con el bloque inicial disponible y el juego aún no jugable.
- Hoja de ruta ampliada con la puerta arquitectónica previa al Bloque 2, los dos renderers, explicación visual de S y herramientas de grafo/replay.
- Agenda ARQ-PEND-001 a 005 para contrato de colocación, puertos canónicos, IDs deterministas, transición atómica y consultas derivadas antes del Bloque 2.
- Bloque 2 completado sin introducir flujo de turnos, puntuación, pases, tranque ni finalización.
- Corregida la cota global de destinos a `2 + 2s ≤ 2 + 2·effectiveK ≤ 16`; el máximo ocho por valor queda demostrado y cubierto por una construcción ejecutable.
- `validateBoardState` admite validar la topología de snapshots activos o terminados; `applyPlay` continúa rechazando colocaciones en una ronda terminada.
- Capacidades de transición de turno, pase y bloqueo marcadas como implementadas; puntuación y resultado definitivo continúan no implementados.
- No se añade migración v3→v4 porque no existen partidas persistidas reales; los snapshots ocupados del Bloque 2 siguen siendo válidos para `validateBoardState`, no para el nuevo contrato reglamentario.
