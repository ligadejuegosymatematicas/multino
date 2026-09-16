# Plan maestro

Este documento define la hoja de ruta del proyecto. Avanzar de fase exige que los criterios de salida de la fase anterior estén satisfechos. Las reglas normativas pertenecen exclusivamente a [`REGLAS.md`](REGLAS.md).

## Estado de fases

| Fase | Estado | Resultado esperado |
| --- | --- | --- |
| 0 — Especificación y arquitectura | COMPLETADA | Reglamento, topología, snapshot e invariantes cerrados |
| 1 — Motor básico | COMPLETADA | Motor puro con tests |
| 2 — Renderer del tablero | EN CURSO — DOS MODOS Y CICLO LOCAL FUNCIONALES | Geometría independiente del modelo lógico |
| 3 — Juego local 2 vs 2 | NO INICIADA | Flujo local completo |
| 4 — UX | NO INICIADA | Interacción accesible y adaptable |
| 5 — Persistencia y herramientas | NO INICIADA | Guardado, carga y reproducción |
| 6 — Multijugador remoto | FUTURA | Sincronización segura y autoritativa |

**Regla estructural vigente:** el producto ofrece únicamente **Ramificado** y **Lineal**. La parametrización histórica K quedó sustituida; el schema v6 conserva un campo interno `1/0` solo como puente de compatibilidad.

## Fase 0 — Especificación y arquitectura

### Alcance

- Formalizar reglas sin inferirlas.
- Definir el modelo lógico del tablero.
- Definir el modelo serializable del estado.
- Fijar invariantes inequívocos.
- Identificar y mantener visibles todas las decisiones pendientes.
- Establecer fronteras entre motor, UI, persistencia y red.

### Criterios de salida

- `REGLAS.md` no contiene ambigüedades silenciosas: cada vacío está marcado `PENDIENTE DE DEFINICIÓN`.
- Existe acuerdo sobre conjunto de fichas, reparto, turnos, conexión, pase, puntuación, cierre, bloqueo y victoria.
- Los ejemplos normativos y casos límite están escritos antes de codificarlos.
- Modelo de tablero, esquema de estado e invariantes han sido revisados juntos.
- El backlog de tests de Fase 1 puede convertirse en casos con resultados esperados inequívocos.

### Revisión final de salida

Cumplido:

- R-001 a R-035 formalizan participantes, material, mezcla, reparto, turnos, compatibilidad, elección, topología, pase, tranque, puntuación y resultado;
- la línea principal es un camino lógico ordenado y las ramificaciones son cadenas laterales derivables;
- el snapshot v3 es autosuficiente y el historial no es necesario para reconstruir el presente;
- tablero, estado, invariantes, decisiones y backlog están sincronizados;
- existen ejemplos normativos A–H y casos de puntuación previos a la implementación;
- los pendientes restantes corresponden solo a modalidades futuras no incluidas en el motor básico.

La Fase 0 **cumple sus criterios de salida y se declara COMPLETADA**. El inicio de la Fase 1 fue autorizado posteriormente.

## Fase 1 — Motor básico

### Progreso incremental

**Bloque 1 — Inicialización de partida: COMPLETADO Y APROBADO.** Incluye material doble-seis, participantes y asientos, configuración estructural, mezcla inyectable, reparto, jugador inicial y validación del snapshot inicial.

**Bloque 2 — Núcleo lógico del tablero: COMPLETADO.** Incluye puertos canónicos, primera colocación, camino interno ordenado, chancho ramificador único, brazos derivados, destinos individualizados, enumeración de ficha+destino, aplicación inmutable, historial y validación topológica.

**Bloque 3 — Turnos, pases y terminación básica: COMPLETADO.** Incluye transición reglamentaria sobre la primitiva topológica, restricción al jugador actual, acciones disponibles, pase obligatorio, avance antihorario, contador de turnos, reinicio de pases, salida y tranque con snapshot terminal v4 validado.

**Bloque 4 — S y puntuación durante las jugadas: COMPLETADO.** Incluye términos explicables derivados del tablero, R-018 para chanchos, suma S, múltiplos de 5, actualización inmutable del marcador, puntuación de la jugada terminal e historial/validación coherentes en schema v5.

**Bloque 5 — Finalización completa de una ronda: COMPLETADO.** Incluye salida y tranque, sumas restantes por equipo, vencedor tradicional, bonificación, marcador final, ganador por puntaje, empate y validación terminal en schema v6.

La Fase 1 cumple sus criterios de salida: una ronda puede jugarse y cerrarse íntegramente mediante la API pública del motor, sin DOM ni geometría. No se autoriza con ello multirronda, metas acumuladas, variantes de puntuación ni renderers.

### Puerta arquitectónica del Bloque 2 — resuelta

DEC-025 a DEC-028 y sus tests cerraron:

- la identidad canónica de cada puerto y extremo derivado;
- que una acción apunte a `placementId + portId`, no solo a un valor;
- la derivación única de extremos principales, orígenes laterales y terminales de rama;
- la separación entre destinos legales y términos que aportan a S.
- el tratamiento de la primera colocación sin destino previo;
- la asignación canónica de puertos simétricos;
- la generación determinista de IDs y el límite transaccional de una acción.

ARQ-PEND-001 a 005 quedan resueltos sin generalizar participantes ni match. El Bloque 4 implementa el contrato separado de términos de puntuación sin fusionarlo con los destinos jugables.

### Alcance

- Generar el conjunto de fichas definido.
- Mezclar las fichas mediante una fuente de aleatoriedad inyectable y repartir conforme a R-006 y R-029.
- Repartir según la regla acordada.
- Modelar jugadores y equipos.
- Gestionar turnos.
- Enumerar jugadas legales.
- Aplicar una jugada de forma determinista.
- Calcular extremos abiertos.
- Aplicar el comportamiento de chanchos.
- Crear y mantener ramificaciones.
- Calcular puntuación.
- Cubrir reglas e invariantes con tests unitarios.
- Derivar el modo estructural y el estado del único ramificador sin duplicar información.
- Derivar ramificaciones, extremos abiertos, S y resultado final desde el snapshot, sin geometría ni fuentes paralelas.
- Mantener `score`, `consecutivePasses` y `specialDoublePlacementIds` como estado operativo persistido y verificable contra el historial.

### Criterios de salida

- El motor se ejecuta y prueba sin DOM.
- Cada transición devuelve un estado válido o un error de dominio explícito.
- Todas las reglas implementadas enlazan con una sección normativa de `REGLAS.md`.
- Se cubren Ramificado, Lineal, conexiones, dobles posteriores, brazos, pase, tranque y finalización.
- Ninguna prueba depende de posiciones visuales.
- Cargar un snapshot válido permite continuar sin reproducir `history`.

## Fase 2 — Renderer del tablero

### Progreso incremental

**Bloque 1 — Capa de proyección pura para Modo Grafo: COMPLETADO.** Incluye grafo de valores, metadatos temporales, agrupación de extremos, jugadas por ficha, destinos concretos, explicación de S y fachada resumida para UI. No contiene DOM, coordenadas, geometría ni renderer.

**Bloque 2 — Primer GraphRenderer funcional: COMPLETADO.** Incluye SVG responsivo sobre heptágono estable, aristas y lazos inspeccionables, una curva individual por destino, mano local, selección ficha/target, START, PASS, puntuación, marcador y cierre de ronda. La UI solo despacha acciones ofrecidas por el motor y vuelve a proyectar el snapshot aceptado.

**Bloque 3 — Primera legibilidad topológica: COMPLETADO (contrato histórico sustituido por Bloque 16).** Añadió la primera proyección pura e inspección contextual del tablero.

**Bloque 4 — Identidad y visibilidad de extremos topológicos: COMPLETADO.** Añade códigos derivados `P`, `A`, `B`… compartidos por raíz, fichas y terminal; refuerza la visibilidad neutral de todos los extremos y la jerarquía compatible/incompatible al seleccionar una ficha. No cambia legalidad, motor ni schema.

**Bloque 5 — Simplificación y gramática visual: COMPLETADO.** Agrupa los dos brazos laterales de cada chancho especial en una sola familia visual `A`, `B`… sin fusionar sus targets exactos; elimina etiquetas redundantes de fichas y letras interiores; distingue brazos potenciales/iniciados y permite inspeccionar ambos brazos con su raíz. No cambia legalidad, motor, schema ni persistencia.

**Bloque 6 — Primer TraditionalRenderer y conmutador: COMPLETADO.** Añade una proyección pura de cadenas tradicionales, mesa interactiva con línea horizontal y dos brazos laterales por chancho especial, fichas con puntos, extremos exactos y selector Grafo ↔ Tradicional. Ambos modos comparten snapshot, acciones y paneles; cambiar vista es estado efímero de UI.

**Bloque 7 — Orientación física, simplificación y cámara tradicional: COMPLETADO.** Corrige cada ficha desde los puertos reales para enfrentar valores iguales, elimina metadata visual redundante en reposo, aligera los símbolos del grafo y añade ajuste/recentrado con viewport desplazable y tamaño mínimo legible. No cambia motor, reglas, schema ni persistencia.

**Bloque 8 — Configuración inicial y nueva partida independiente: COMPLETADO.** Añade una pantalla previa al reparto para elegir modo estructural y vista inicial, más acciones terminales para volver a jugar o cambiar configuración. Cada inicio llama de nuevo a `createMatch`, descarta por completo el snapshot/controlador anterior y conserva solo preferencias explícitas de UI; no introduce MatchState ni acumulados.

**Bloque 9 — Jerarquía y feedback general de juego: COMPLETADO.** Compacta título y estado en una banda, ordena la experiencia como tablero → mano → cantidades secundarias, aligera el SVG y la mesa, mejora la escala mínima/recentrado tradicional y añade feedback efímero para puntos, turno y apertura de rama. Todo se deriva de proyecciones y del último evento aceptado; no cambia motor, schema ni reglas.

**Bloque 10 — Escala, capas y mano de juego: COMPLETADO.** Adapta la geometría del Grafo a panel ancho o compacto, amplía escenas tradicionales holgadas sin reducir el mínimo legible, termina conectores en las caras de las fichas y fija su capa por debajo del dominó. La mano usa mini-fichas de puntos, omite el rótulo de destino único y acerca tablero/mano en ambos tamaños.

**Bloque 11 — Presentación de puntuación y privacidad local: COMPLETADO.** Añade un contrato puro de presentación para términos, S, divisor y resolución de la última jugada; ambos renderers muestran una secuencia breve y compartida sin leer colitas como sustituto de `scoringTerms`. Entre turnos se oculta la siguiente mano hasta una revelación explícita, y el cierre prioriza ganador final/empate. La política activa continúa siendo exclusivamente múltiplos de 5; no cambia schema, persistencia ni reglas.

**Bloque 12 — Legibilidad estratégica y prioridad tradicional: COMPLETADO.** Corrige conectores/targets para que ningún segmento invada fichas, adopta Tradicional como vista inicial y mantiene Grafo como vista analítica. Añade una proyección pura por target con resultado exacto de motor, pero la UX estándar no revela S ni puntos antes de ejecutar la jugada. El feedback posterior conserva términos → S → divisibilidad → puntos.

**Bloque 13 — Vista experimental Puertos: COMPLETADO.** Añade una tercera representación con siete macro-nodos fijos, seis incidencias canónicas por valor, hilos exteriores para fichas no dobles, puentes interiores para conexiones y hubs de dos o cuatro sockets para chanchos. Las ramas reutilizan los mismos siete valores y los targets conservan `placementId + portId`; proyección, geometría, foco local y renderer son descartables y no cambian snapshot, motor ni schema.

**Bloque 14 — Puertos v2, revelado progresivo y carriles anulares: COMPLETADO.** Sustituye hilos rectos de igual peso por curvas Bézier anulares, jerarquiza reposo/decisión/inspección, permite seguir recorridos y materializa «abrir el saco» como lente SVG de seis incidencias, puentes, hub y targets. Sus comparaciones K quedaron históricamente sustituidas por Bloque 16.

**Bloque 15 — Puertos v3 game-first y tapa central: COMPLETADO.** La posición normal conserva siete valores y extremos exactos, pero omite hilos/puentes completos y 42 puertos potenciales. Seguir recorrido revela solo la estructura elegida; Ver estructura recupera v2; abrir el saco mantiene detalle local. La tapa aloja feedback reglamentario y la UI común se compacta para acercar tablero y mano.

**Bloque 16 — Consolidación de modos estructurales: COMPLETADO.** Sustituye la configuración pública K por **Ramificado/Lineal**. Ramificado habilita exclusivamente el primer doble colocado; Lineal conserva una única cadena. Añade proyección pura `n/7`, conteo de targets reales y estado del único chancho ramificador sin cambiar schema v6.

**Siguiente bloque: NO AUTORIZADO.** Continúan fuera configuración del divisor `n`, multirronda, refinamiento visual premium, panel estructural completo, zoom gestual avanzado, replay y animaciones complejas. No se inicia ninguna de esas capacidades por completar esta iteración.

**Estudio registrado — reversibilidad Grafo/Tradicional: PROYECCIÓN Y PRIMER RENDERER MATERIALIZADOS.** La secuencia lógica se deriva de `mainLine + placements + connections + ports` sin persistencia ni schema nuevo. La orientación física de cadenas rectas ya respeta cada conexión; giros adaptativos, zoom gestual y acabado avanzado continúan pendientes. Véase `docs/reversibilidad-grafo-tradicional.md`.

**Estudio de UX posterior a prueba manual: CUATRO ITERACIONES FUNCIONALES COMPLETADAS.** Se adoptaron estilo topológico permanente, inspección contextual, clasificación de targets y familias alfabéticas por chancho especial. La vista normal prioriza valores, extremos y posibilidades estratégicas; la reconstrucción espacial exacta se ofrece ahora en el primer Modo Tradicional. Véase `docs/ux-topologia-modo-grafo.md`.

### Alcance

- Dibujar fichas.
- Representar la línea principal.
- Representar ramificaciones.
- Resolver orientación y geometría visual.
- Adaptar automáticamente el trazado al espacio disponible.
- Mantener la separación entre modelo lógico y coordenadas.
- Mantener GraphRenderer sobre siete vértices como vista analítica disponible.
- Mantener PortRenderer como prototipo intermedio de valores e incidencias, sin convertirlo en autoridad reglamentaria.
- Implementar TraditionalRenderer sobre el mismo snapshot.
- Permitir alternancia de vista sin acción de dominio.
- Representar extremos repetidos con identidad individual y solución híbrida adaptable.

### Criterios de salida

- El renderer recibe un snapshot y no lo muta.
- Cambiar de renderer no requiere modificar reglas.
- Las coordenadas y rotaciones no aparecen en el estado normativo.
- Se verifican tableros representativos y redimensionamiento.
- Los tres renderers producen selecciones equivalentes para el mismo conjunto de jugadas legales.
- El Modo Grafo soporta hasta ocho extremos del mismo valor sin perder accesibilidad ni selección individual.

## Fase 3 — Juego local 2 vs 2

### Alcance

- Cuatro jugadores locales.
- Equipos A/B.
- Gestión de manos.
- Ocultamiento y visualización adecuada de fichas.
- Indicador del turno actual.
- Marcador.
- Flujo completo de una mano.
- Nueva mano.
- Nueva partida.

### Criterios de salida

- Una mano completa puede jugarse usando únicamente acciones públicas del motor.
- La UI no accede a reglas internas ni altera snapshots.
- El orden de asientos y turnos coincide con `REGLAS.md`.
- Las transiciones de nueva mano y nueva partida tienen tests.

## Fase 4 — UX

### Alcance

- Selección de fichas.
- Destacar jugadas legales.
- Animaciones y sonidos opcionales.
- Historial visible.
- Tutorial.
- Diseño responsive.
- Accesibilidad básica de teclado, foco, contraste y anuncios de estado.
- Resaltado y animación discreta de extremos compatibles.
- Fórmula de S enlazada visualmente con sus fuentes sin recalcular reglas en UI.

### Criterios de salida

- Las animaciones son una consecuencia del cambio de estado, no una fuente de verdad.
- El flujo principal funciona con teclado y táctil.
- Preferencias visuales o sonoras no contaminan el estado del motor.

## Fase 5 — Persistencia y herramientas

### Alcance

- Guardar estado.
- Cargar partida.
- Reproducir historial.
- Herramientas de debugging.
- Exportar e importar JSON.
- Migrar versiones de esquema cuando corresponda.
- Inspeccionar el grafo final con metadatos de ficha, jugador, turno y puntuación.
- Reproducir `G₀ → G₁ → … → Gₖ` desde acciones aceptadas.

### Criterios de salida

- Un snapshot exportado se valida antes de cargarlo.
- Las migraciones son explícitas y probadas.
- Un historial compatible reproduce el resultado esperado o informa una incompatibilidad.

## Fase 6 — Multijugador remoto

Esta fase es solo una dirección arquitectónica futura. No se desarrolla antes de completar las anteriores.

### Alcance futuro

- Salas.
- Identificación de jugadores.
- Sincronización de acciones y snapshots.
- Servidor autoritativo o arquitectura equivalente.
- Ocultamiento seguro de manos.
- Reconexiones.
- Validación de jugadas en servidor.
- Versionado de protocolo e idempotencia de acciones.

### Riesgos que deberán resolverse

- Un snapshot completo contiene información secreta y no debe enviarse igual a todos los clientes.
- La aleatoriedad, la autoridad y el orden de acciones deben ser verificables.
- El motor compartido no sustituye la validación del servidor.

## Regla de avance

No se marca una fase como completada solo por existir código. Deben cumplirse sus criterios de salida, actualizarse `CHANGELOG.md` y quedar resueltas o registradas las decisiones correspondientes.

## Investigación de producto sin fase asignada

No forma parte de Fase 1 ni autoriza implementación:

- `Divisible por n`, comenzando por simulaciones de `n = 3, 4, 6, 7`;
- `Sin divisibilidad` para una ronda y, después, series;
- separación RoundState/MatchState cuando exista una condición multirronda aprobada;
- mejor de 3, mejor de 5 y metas de puntuación;
- 1 vs 1 y cuatro jugadores todos contra todos;
- otras cantidades de participantes solo si justifican pozo, reparto y reglas nuevas.

Las evaluaciones y bloqueos normativos están en [`docs/variantes-futuras.md`](docs/variantes-futuras.md) y [`docs/modelo-round-match.md`](docs/modelo-round-match.md).
