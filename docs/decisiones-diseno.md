# Registro de decisiones de diseño

Las decisiones se numeran y no se reescriben silenciosamente. Si una decisión cambia, se añade otra que la sustituye y se enlazan ambas.

## DEC-001 — Separar motor y renderer

**Estado:** Aceptada.

**Decisión:** El motor no utiliza DOM, HTML, CSS, animaciones, coordenadas ni rotaciones gráficas.

**Motivo:** Permitir tests sin navegador, varios renderers, replay, persistencia y reutilización futura en un servidor.

**Alternativas consideradas:** Mantener reglas dentro de componentes de UI; usar el tablero visual como fuente de verdad.

**Consecuencias:** La UI traduce IDs lógicos a geometría. “Línea horizontal principal” se conserva como presentación física, pero el motor solo conoce `mainLine` como concepto lógico.

## DEC-002 — JavaScript nativo y cero dependencias externas en Fase 0

**Estado:** Aceptada.

**Decisión:** Usar HTML, CSS y módulos ES, más módulos estándar de Node para desarrollo y tests.

**Motivo:** La entrega no necesita build ni estado visual complejo.

**Alternativas consideradas:** Framework de componentes, TypeScript, bundler y librería de tests.

**Consecuencias:** Publicación sencilla y poca superficie de mantenimiento. Una dependencia futura requerirá una nueva decisión justificada.

## DEC-003 — Tablero lógico como grafo de colocaciones y puertos

**Estado:** Aceptada.

**Decisión:** Una ficha colocada es un nodo, una conexión es una arista y cada punto conectable es un puerto lógico.

**Motivo:** Admitir ramificaciones y chanchos de hasta cuatro conexiones sin geometría.

**Alternativas consideradas:** Lista lineal con excepciones; cuadrícula; coordenadas como estado; árbol estricto.

**Consecuencias:** El renderer calcula layout. Las reglas deben formalizar puertos y topologías antes de implementar legalidad.

## DEC-004 — Snapshots JSON versionados e historial de acciones

**Estado:** Aceptada.

**Decisión:** El estado usa datos JSON y `schemaVersion`; las acciones aceptadas se registran en orden estable.

**Motivo:** Guardado, inspección, replay, migración y sincronización futura.

**Alternativas consideradas:** Referencias circulares; guardar solo eventos; guardar solo el tablero visible.

**Consecuencias:** No se almacenan funciones ni DOM. El proyecto no adopta event sourcing puro: snapshot e historial deben reconciliarse mediante invariantes.

## DEC-005 — `index.html` en la raíz

**Estado:** Aceptada.

**Decisión:** Colocar la entrada web en la raíz y conservar código y estilos en `src/`.

**Motivo:** Publicación directa mediante GitHub Pages sin build.

**Alternativas consideradas:** `src/index.html` con despliegue personalizado; carpeta `docs/`; salida `dist/`.

**Consecuencias:** La raíz contiene la entrada, pero los enlaces funcionan en el subdirectorio del repositorio.

## DEC-006 — Datos planos y fábricas en el modelo

**Estado:** Aceptada.

**Decisión:** Representar estado, fichas y tablero con objetos y arrays planos, no con prototipos necesarios para interpretar JSON.

**Motivo:** JSON no conserva clases y la lógica pertenece al motor.

**Alternativas consideradas:** Clases con métodos y referencias entre instancias.

**Consecuencias:** Serialización sencilla; los invariantes se validan mediante funciones explícitas.

## DEC-007 — No usar valores provisionales para reglas pendientes

**Estado:** Aceptada.

**Decisión:** Una capacidad no implementada o parcialmente especificada lo declara; no devuelve resultados ficticios.

**Motivo:** Evitar que ceros, falsos o convenciones temporales se conviertan en reglas accidentales.

**Alternativas consideradas:** Aplicar reglas comunes de otras variantes; simular resultados hasta terminar el motor.

**Consecuencias:** La especificación está completa, pero el juego sigue no jugable hasta implementar los bloques funcionales correspondientes. Los módulos distinguen “especificado” de “implementado”.

## DEC-008 — Tests con el ejecutor integrado de Node

**Estado:** Aceptada.

**Decisión:** Usar `node:test` para la infraestructura inicial.

**Motivo:** Probar módulos ES puros sin navegador ni dependencias.

**Alternativas consideradas:** Vitest, Jest y pruebas manuales.

**Consecuencias:** Configuración mínima; nuevas necesidades deberán justificar otra herramienta.

## DEC-009 — Una única clasificación persistida de la topología

**Estado:** Aceptada; sustituye la propuesta redundante de DEC-003 donde sea necesario y es refinada por DEC-015.

**Decisión:** Persistir solo `board.mainLine.placementIds` como clasificación de pertenencia a la línea principal. Eliminar `placement.region` y `board.branches` del esquema persistido. Las ramificaciones se derivan como componentes conectados de las colocaciones fuera de `mainLine`.

**Motivo:** `region`, `mainLine` y `branches` expresaban el mismo hecho en varios lugares y podían divergir.

**Alternativas consideradas:** Mantener los tres campos con validadores; persistir solo `region`; asignar IDs de rama permanentes.

**Consecuencias:** El grafo y `mainLine` son las fuentes normativas. No hay identidad persistente de rama por ahora. Si una futura regla requiere identidad de rama no derivable, deberá aprobarse una nueva decisión y migración de esquema.

## DEC-010 — Derivar la condición de chancho especial

**Estado:** Sustituida por DEC-013.

**Decisión:** No persistir `placement.role` ni `specialMainLineDoubleIds`. Derivar el conjunto especial filtrando chanchos de `mainLine`, ordenándolos por sus acciones de colocación en `history` y tomando los primeros `effectiveK`.

**Motivo:** Ambos campos duplicaban un hecho completamente determinado por ficha, pertenencia, cronología y K.

**Alternativas consideradas:** Persistir el rol en cada colocación; mantener una lista ordenada paralela; emitir un evento separado de habilitación.

**Consecuencias:** `history` forma parte del estado completo. Importación y replay deben preservar orden. Una caché del conjunto especial es admisible solo si es descartable.

## DEC-011 — Conservar K reglamentario y derivar K efectivo

**Estado:** Aceptada.

**Decisión:** Validar el K configurado como entero no negativo y conservar su valor exacto. Derivar `effectiveK = min(K, 7)` sin persistirlo.

**Motivo:** R-027 no fija máximo, mientras R-005 implica que existen solo siete chanchos.

**Alternativas consideradas:** Rechazar K mayor que 7; normalizar y almacenar 7; no validar K.

**Consecuencias:** K mayor que 7 es válido y tiene el mismo efecto posible que 7. La UI puede explicar la equivalencia, pero no alterar silenciosamente la configuración.

## DEC-012 — Esquema de estado v2 sin pozo ni marcadores derivados

**Estado:** Sustituida parcialmente por DEC-014. Se conserva la eliminación de `stock` y campos topológicos redundantes; se revierte la decisión de derivar el marcador actual.

**Decisión:** Elevar `schemaVersion` a 2, eliminar `stock`, eliminar los campos redundantes del tablero y derivar puntuación, pases consecutivos y resultado final desde historial y estado terminal.

**Motivo:** R-006 excluye pozo y sobrantes; las proyecciones derivables no deben competir con sus fuentes.

**Alternativas consideradas:** Conservar `stock` como colección siempre vacía; almacenar puntos y resultado además del historial; mantener schema v1 durante Fase 0.

**Consecuencias:** El contrato refleja el reglamento consolidado. No existen partidas persistidas que migrar; una futura migración v1→v2 deberá definirse solo si aparece un snapshot v1 real.

## DEC-013 — Persistir la condición especial adquirida

**Estado:** Aceptada; sustituye DEC-010.

**Decisión:** Persistir `board.specialDoublePlacementIds` como lista ordenada de las colocaciones que adquirieron condición especial.

**Motivo:** La condición histórica modifica la capacidad presente de una colocación. El motor debe consultarla sin reconstruir cronología desde `history`.

**Alternativas consideradas:** Derivar desde historial, K y línea principal; persistir `placement.role` en cada nodo; mantener una lista no ordenada.

**Consecuencias:** La lista es fuente normativa y `placement.role` sigue sin persistirse. Debe contener solo chanchos de `mainLine`, conservar orden, no superar `effectiveK` y permanecer estable. El historial la audita, pero no la reemplaza.

## DEC-014 — Snapshot autosuficiente y esquema v3

**Estado:** Aceptada; sustituye parcialmente DEC-012.

**Decisión:** El snapshot v3 persiste `score.teams`, `consecutivePasses` y `specialDoublePlacementIds`. `history` deja de ser necesario para reconstruir propiedades fundamentales del presente.

**Motivo:** El proyecto no usa event sourcing puro. Cargar o sincronizar un snapshot debe permitir continuar inmediatamente sin recorrer todas las acciones.

**Alternativas consideradas:** Derivar marcador y pases desde el historial; usar snapshots periódicos más una cola de eventos; persistir solo el último subtotal.

**Consecuencias:** Snapshot e historial pueden representar información relacionada con responsabilidades diferentes. El snapshot es operativo; el historial explica y verifica. Una discrepancia viola invariantes. `stock` continúa ausente y no existen partidas reales que requieran migración v2→v3.

## DEC-015 — `mainLine.placementIds` es un recorrido ordenado

**Estado:** Aceptada; refina DEC-009.

**Decisión:** El array representa el orden lógico de un extremo principal al otro. Extender un extremo agrega al inicio o al final; las conexiones entre elementos consecutivos forman el camino principal.

**Motivo:** Una colección sin orden no identificaba por sí sola los dos extremos ni la continuidad principal a través de chanchos especiales.

**Alternativas consideradas:** Conservar pertenencia sin orden y recorrer el grafo; persistir dos IDs de extremos además de una colección; persistir coordenadas.

**Consecuencias:** Los extremos principales se derivan sin geometría ni campos duplicados. El orden es semántico, no visual. Deben validarse unicidad, adyacencia consecutiva y ausencia de ciclos.

## DEC-016 — Ramificaciones derivadas como cadenas laterales

**Estado:** Aceptada; confirma DEC-009 bajo R-034 y R-035.

**Decisión:** No persistir `board.branches`. Cada rama se deriva desde una arista `branch:*` de un chancho especial y debe formar un camino simple desconectado de las demás ramas salvo por su único origen principal.

**Motivo:** Las reglas topológicas ya permiten reconstruir inequívocamente cada cadena y su puerto de origen.

**Alternativas consideradas:** IDs y arrays de ramas persistidos; árbol genérico; `placement.region`.

**Consecuencias:** La topología queda limitada a un camino principal con cadenas laterales. Si una futura modalidad admite ramas secundarias, necesitará reglas, decisión y probablemente un nuevo esquema.

## DEC-017 — Aleatoriedad inyectable y reparto técnico circular

**Estado:** Aceptada.

**Decisión:** Mezclar una copia de los 28 IDs mediante Fisher–Yates y una función `randomSource` inyectable. Repartir la secuencia resultante en orden circular: la ficha de índice `i` se asigna al asiento de índice `i mod 4` en `seating.counterclockwisePlayerIds`.

**Motivo:** R-029 exige una mezcla aleatoria, pero no prescribe algoritmo ni orden informático de reparto. La inyección permite pruebas deterministas y la convención circular hace reproducible el resultado una vez fijada la permutación.

**Alternativas consideradas:** Usar directamente `Math.random` dentro del reparto; mutar la colección recibida; entregar bloques consecutivos de siete; convertir Fisher–Yates en regla normativa.

**Consecuencias:** La API no pierde, duplica ni muta silenciosamente fichas. `Math.random` es solo el valor predeterminado de producción. Tanto Fisher–Yates como `i mod 4` son decisiones técnicas reemplazables si preservan R-006 y R-029; no añaden reglas al reglamento.

## DEC-018 — Creación atómica y sin evento histórico artificial

**Estado:** Aceptada.

**Decisión:** `createMatch` recibe configuración todavía no materializada, prepara y valida el snapshot completo, y solo expone el resultado en fase `playing`. La transición conceptual `setup → playing` es atómica; el primer turno usa `turnNumber: 1` y `history` comienza vacío.

**Motivo:** Ningún consumidor debe observar un reparto parcial. Generar catálogo, mezclar y asignar estructuras son pasos técnicos, no acciones de dominio útiles para replay.

**Alternativas consideradas:** Exponer snapshots intermedios en `setup`; registrar eventos internos de generación y mezcla; crear una acción sintética `MATCH_CREATED` sin necesidad normativa.

**Consecuencias:** Un retorno exitoso siempre está listo para la futura primera jugada y supera el validador inicial. Un error no deja estado parcialmente creado. El historial comienza cuando exista una acción de dominio aceptada; `turnNumber: 1` es una convención técnica documentada, no una regla adicional.

## DEC-019 — Distinguir grafo del tablero y grafo de valores

**Estado:** Aceptada.

**Decisión:** Reservar “grafo lógico del tablero” para colocaciones, puertos y conexiones del motor. El Modo Grafo utiliza una proyección distinta con siete vértices de valor, aristas para fichas no dobles y lazos para chanchos.

**Motivo:** Colapsar todas las apariciones de un valor hace visible el material, pero pierde orden, ramas e identidad de extremos repetidos. Tratar ambas estructuras como una sola introduciría reglas dependientes del renderer.

**Alternativas consideradas:** Reemplazar Board por el grafo de siete vértices; duplicar ambos grafos en el snapshot; representar cada extremo como un vértice adicional persistido.

**Consecuencias:** El grafo de valores se deriva y nunca es fuente normativa. Cada arista visual referencia ficha y colocación. Los extremos se superponen como objetivos individuales derivados.

## DEC-020 — Renderers intercambiables y Modo Grafo predeterminado

**Estado:** Aceptada como decisión de producto, revisable mediante prototipos.

**Decisión:** Prever GraphRenderer y TraditionalRenderer sobre el mismo snapshot. GraphRenderer será la vista inicial predeterminada, con cambio de vista puramente representacional.

**Motivo:** Permitir una forma de juego propia basada en el grafo sin renunciar a la lectura tradicional ni duplicar el motor.

**Alternativas consideradas:** Solo vista tradicional; grafo decorativo secundario; snapshots específicos por vista.

**Consecuencias:** La preferencia de renderer, layout, zoom y animación pertenece a UI local. Ningún renderer muta el snapshot. El cambio debe poder hacerse durante la ronda sin acción de dominio.

## DEC-021 — Extremos individualizados, derivados y dirigibles

**Estado:** Aceptada e implementada por DEC-025 y DEC-028.

**Decisión:** Cada extremo abierto será dirigible mediante una referencia lógica estable de colocación y puerto. La colección, su ID compuesto y su agrupación por valor se derivan; no se persiste un array `openEnds`.

**Motivo:** R-030 permite elegir entre destinos diferentes con el mismo valor. GraphRenderer colapsa esos valores y necesita recuperar la identidad individual sin crear una fuente paralela.

**Alternativas consideradas:** Elegir solo por valor; persistir extremos y multiplicidades; dejar que cada renderer reconstruya destinos con reglas propias.

**Consecuencias:** Toda acción posterior a la primera refiere un destino concreto, no solamente el número compatible. El Bloque 2 fija y prueba la forma canónica `placementId + portId`.

## DEC-022 — Separar reglas de partida y preferencias de representación

**Estado:** Aceptada.

**Decisión:** Sistema de puntuación, K/topología, condición de victoria y participantes son configuración de dominio. Renderer, layout, zoom, animación y modo de vista son preferencias de representación.

**Motivo:** Combinar ambos grupos produciría snapshots distintos para una misma partida y dificultaría replay, persistencia y multijugador.

**Alternativas consideradas:** Incluir `viewMode` en `config`; permitir que GraphRenderer adapte reglas; crear una modalidad de juego distinta por renderer.

**Consecuencias:** Cambiar vista no altera hashes, acciones ni resultado. Las variantes futuras podrán usar cualquiera de los dos renderers sin duplicarse.

## DEC-023 — Posponer RoundState/MatchState hasta aprobar multirronda

**Estado:** Aceptada; la conservación específica de schema v3 queda sustituida por DEC-030, DEC-033 y DEC-034, sin alterar el aplazamiento de RoundState/MatchState.

**Decisión:** Mantener `createMatch` y un único snapshot de ronda mientras no exista una modalidad multirronda. Si se aprueba una serie o meta acumulada, introducir un coordinador MatchState alrededor de un RoundState equivalente al ciclo actual.

**Motivo:** La separación es útil para mejores-de-N y metas, pero hoy no existe una regla que defina acumulación, empates de ronda o cierre de series.

**Alternativas consideradas:** Refactorizar ahora nombres y esquema; mezclar acumulados futuros en `score`; impedir cualquier evolución multirronda.

**Consecuencias:** El Bloque 2 no requiere migración. K, tablero, manos e historial siguen perteneciendo al ciclo actual. Una futura separación exigirá reglamento, decisión de esquema y migración explícitos.

## DEC-024 — Aislar la política de puntuación sin habilitar variantes

**Estado:** Aceptada e implementada para toda la puntuación de una ronda.

**Decisión:** Implementar R-014–R-026 de modo que el literal 5 y el cálculo aprobado estén concentrados en el módulo de puntuación, no dispersos por tablero, UI o historial. No exponer todavía un divisor configurable.

**Motivo:** Facilitar tests y estudiar `Divisible por n` posteriormente sin presentar reglas experimentales como disponibles.

**Alternativas consideradas:** Codificar 5 en cada consumidor; añadir ahora `divisor` al snapshot; implementar una jerarquía extensible antes de tener variantes aprobadas.

**Consecuencias:** La modalidad actual sigue siendo exclusivamente n=5. Cualquier política nueva necesitará reglas propias, especialmente sobre la bonificación final.

## Agenda técnica del Bloque 2 — resuelta

No son vacíos de `REGLAS.md`; son contratos de implementación que deben resolverse explícitamente al planificar el bloque:

### ARQ-PEND-001 — Forma de la acción de colocación

**Estado:** Resuelto por DEC-025.

Distinguir la primera ficha, que no tiene destino previo, de las siguientes jugadas, que deben referenciar `placementId + portId`. Decidir si existe un destino discriminado `BOARD_START` o un tipo de acción inicial separado.

### ARQ-PEND-002 — Puertos canónicos de la ficha colocada

**Estado:** Resuelto por DEC-026.

R-030 deja la orientación gráfica al renderer. Debe definirse cómo el motor asigna de forma determinista `side:a/side:b` o `main:1/main:2` cuando hay simetría, sin enumerar como diferentes dos jugadas que reglamentariamente son la misma elección.

### ARQ-PEND-003 — IDs deterministas

**Estado:** Resuelto por DEC-027.

Definir cómo se producen `placementId` y `connectionId` para que una acción aceptada sea reproducible, testeable y sincronizable sin depender de UUID aleatorio interno.

### ARQ-PEND-004 — Límite transaccional y validación

**Estado:** Resuelto por DEC-025 y DEC-027.

Fijar la API que recibe snapshot más acción, devuelve un snapshot nuevo y valida invariantes del tablero ocupado. Debe especificar errores de dominio y garantizar que una acción rechazada no consuma IDs ni altere historial.

### ARQ-PEND-005 — Consultas derivadas

**Estado:** Resuelto por DEC-028.

Separar contratos para `openEndTargets`, `legalMoves` y `scoringTerms`. Pueden compartir derivación, pero no deben ser un único array interpretado de manera distinta por motor y renderers.

ARQ-PEND-001 a 005 quedaron resueltos antes y durante la implementación. El Bloque 4 completa el desglose separado de puntuación conforme a DEC-032.

## DEC-025 — Acción de jugada discriminada y transición de tablero

**Estado:** Aceptada.

**Decisión:** `applyPlay(state, action)` recibe `playerId`, `dominoId` y un destino discriminado: `{ kind: "START" }` para la primera ficha o `{ kind: "OPEN_END", placementId, portId }` después. Valida antes de clonar y devuelve un snapshot nuevo. En este bloque no avanza `currentPlayerId`, `turnNumber`, `consecutivePasses` ni `score`.

**Motivo:** La primera ficha no se conecta; las posteriores deben elegir un extremo individual. El flujo de turno no debe inventarse para probar una transición topológica de bajo nivel.

**Alternativas consideradas:** `target: null`; acciones distintas para inicio y extensión; destino por valor; avanzar parcialmente el turno.

**Consecuencias:** La primera jugada solo se acepta al jugador inicial. Después, el caller de bajo nivel indica el jugador; un futuro coordinador de turnos será responsable de autorizarlo y avanzar. El historial registra el `turnNumber` recibido, sin fabricar un turno nuevo.

## DEC-026 — Puertos canónicos sin orientación geométrica

**Estado:** Aceptada.

**Decisión:** Una colocación ordinaria expone `side:a` y `side:b`, en correspondencia directa con los IDs de lados del catálogo. Un chancho especial reemplaza esa interfaz por `main:1`, `main:2`, `branch:1`, `branch:2`; técnicamente `a → main:1` y `b → main:2`. Al colocarlo sobre una línea existente, `main:1` es el puerto de entrada y `main:2` queda como continuidad. Un doble ordinario usa `side:a` como entrada canónica.

**Motivo:** Los dobles son simétricos, pero conexiones, replay y tests requieren IDs estables. La convención elimina duplicados lógicos sin afirmar izquierda, derecha ni rotación.

**Alternativas consideradas:** Persistir orientación; escoger puertos aleatoriamente; enumerar ambas orientaciones simétricas; conservar simultáneamente puertos `side:*` y `main:*`.

**Consecuencias:** La orientación lógica se deriva de conexiones. No se persiste `connectedSide`, ángulo ni dirección. En la primera colocación ambos puertos principales quedan disponibles.

## DEC-027 — IDs secuenciales derivados del snapshot

**Estado:** Aceptada.

**Decisión:** Generar `placement-N` y `connection-N` usando uno más que el máximo sufijo canónico presente en los mapas respectivos. `sequence` usa uno más que el máximo del historial. No existen contadores globales ni campos persistidos adicionales.

**Motivo:** Un snapshot cargado contiene toda la información necesaria para continuar y producir IDs reproducibles.

**Alternativas consideradas:** UUID; coordenadas; contadores globales; persistir `nextPlacementId` y `nextConnectionId`.

**Consecuencias:** Los validadores rechazan claves no canónicas, colisiones e incoherencias clave/ID. La primera conexión es `connection-1`, aunque corresponde a `placement-2`; la primera jugada registra `connectionId: null`.

## DEC-028 — Consultas separadas para destinos, jugadas y puntuación

**Estado:** Aceptada.

**Decisión:** `getOpenEndTargets` deriva destinos individualizados; `getLegalPlays` produce el producto válido ficha+destino; `getScoringTerms` deriva contribuciones numéricas explicables mediante un contrato distinto. `START` no es un extremo abierto y, con tablero vacío, la consulta de extremos devuelve `[]`.

**Motivo:** Varios destinos pueden compartir valor, y los chanchos prueban que un puerto disponible no equivale a un término de S.

**Alternativas consideradas:** Un único array con interpretación contextual; extremos agrupados solo por valor; devolver puntuación provisional 0.

**Consecuencias:** El Modo Grafo podrá seleccionar destinos concretos y explicar S sin equiparar puertos libres a aportes. `getScoringTerms` consume el mismo tablero y no redefine `getOpenEndTargets`.

## DEC-029 — Separar transición reglamentaria y primitiva topológica

**Estado:** Aceptada.

**Decisión:** Mantener `applyPlay(state, action)` como primitiva topológica y añadir `applyTurnAction(state, action)` como transición reglamentaria. La capa superior acepta exclusivamente `PLAY_DOMINO` y `PASS`, exige `currentPlayerId`, valida la acción disponible, compone `applyPlay` para colocar y coordina pases, avance y terminación básica.

**Motivo:** Los tests de tablero necesitan construir topologías sin simular una ronda completa, mientras UI, replay reglamentario y futuros adaptadores no deben poder omitir el turno.

**Alternativas consideradas:** Convertir `applyPlay` en la única transición completa; duplicar la colocación dentro del coordinador; retirar inmediatamente la exportación pública de bajo nivel.

**Consecuencias:** `applyPlay` continúa pública por compatibilidad y tests, pero se documenta como API de bajo nivel no destinada a UI. `PLAY_DOMINO` sigue registrándose dentro de esa primitiva y `applyTurnAction` no duplica el evento; el Bloque 4 enriquece esa misma entrada y actualiza el marcador sin mover reglas al tablero.

## DEC-030 — Turno reglamentario y snapshot terminal mínimo

**Estado:** Aceptada.

**Decisión:** Elevar el snapshot a schema v4. En una ronda activa, `turnNumber` identifica la próxima acción reglamentaria y vale `history.length + 1`. Después de una acción no terminal aumenta una unidad. Si la acción termina la ronda, el snapshot conserva su número, de modo que `turnNumber === history.length === history.at(-1).turn`. `currentPlayerId` conserva al actor terminal.

La fase terminal es `finished` y contiene exclusivamente uno de estos resultados:

```js
{ reason: "BLOCKED" }
```

```js
{
  reason: "EMPTY_HAND",
  finishingPlayerId,
  finishingTeamId
}
```

**Motivo:** No debe fabricarse un quinto turno después del tranque ni un sucesor después de la salida. Al mismo tiempo, el snapshot debe permitir distinguir ambos cierres sin inventar puntuación, bonificación o ganador.

**Alternativas consideradas:** Incrementar siempre `turnNumber`; persistir `nextPlayerId: null`; incluir ganador tradicional o marcador final incompletos; conservar schema v3 porque `roundResult` es aditivo.

**Consecuencias:** `roundResult` está ausente en `playing` y presente en `finished`. Schema v4 hizo visible que los snapshots ocupados exigen un evento único por turno y semántica reglamentaria, aunque la topología del tablero no cambie. No se implementó migración v3→v4 porque no existen partidas persistidas reales. `validateRoundState` comprueba la relación entre fase, turno, historial, pases, actor y manos. La bonificación y el resultado definitivo continúan pendientes.

## DEC-031 — Acciones disponibles para el jugador actual

**Estado:** Aceptada.

**Decisión:** Exponer `getAvailableActions(state)`. En `playing` devuelve todas las acciones `PLAY_DOMINO` de `currentPlayerId` cuando existe al menos una; si no existe ninguna devuelve exactamente `{ type: "PASS", playerId }`. En `finished` devuelve `[]`.

**Motivo:** La UI y las simulaciones necesitan una consulta que no obligue a reinterpretar `getLegalPlays` ni a decidir por su cuenta cuándo aparece el pase.

**Alternativas consideradas:** Usar directamente `getLegalPlays` y fabricar `PASS` en cada consumidor; incluir simultáneamente `PASS` y jugadas legales; exponer comandos de UI específicos.

**Consecuencias:** `getLegalPlays` conserva su responsabilidad topológica y puede consultar manos concretas. La selección reglamentaria depende de `getAvailableActions`; `PASS` nunca aparece si existe una jugada legal, incluido el tablero vacío del primer turno.

## DEC-032 — Términos explicables de S separados de los destinos

**Estado:** Aceptada.

**Decisión:** `getScoringTerms(state)` devuelve, en orden de `placement-N`, un término por cada lado libre de una ficha no doble. El término identifica `placementId`, `dominoId`, `portId`, valor, contribución y motivo. Una ficha no doble completamente conectada no produce términos. Cada chancho produce en cambio un único término agrupado con `connectionCount`: aporta `2N` con cero o una conexión y 0 desde la segunda, aunque sea especial y conserve puertos libres.

`calculateOpenEndsSum(state)` se limita a sumar `contribution` de esos términos. `calculateMoveScore(S)` concentra el divisor reglamentario 5 y devuelve `S / 5` solo cuando S es múltiplo de 5.

**Motivo:** R-018 cuenta un chancho como unidad de puntuación y no por cantidad de puertos visibles. La UI necesita explicar S sin confundir capacidad de conexión con aporte numérico.

**Alternativas consideradas:** Sumar directamente `getOpenEndTargets`; omitir términos de aporte 0; recalcular S por una segunda ruta; persistir todo el desglose en cada evento.

**Consecuencias:** Un chancho con dos o más conexiones sigue apareciendo con contribución 0 para que la explicación sea explícita. Destinos y términos pueden tener cardinalidades distintas. El desglose permanece derivado; el historial persiste solo el total y los puntos.

## DEC-033 — Auditoría de puntuación y schema v5

**Estado:** Aceptada.

**Decisión:** Después de `applyPlay`, `applyTurnAction` calcula S sobre el tablero resultante, calcula los puntos, los suma al equipo obtenido de `players[playerId].teamId` y añade `openEndsSum` y `scoreAwarded` al evento `PLAY_DOMINO` ya existente. Solo después reinicia pases y comprueba salida. Elevar el snapshot reglamentario a schema v5.

`validateRoundState` exige que cada jugada tenga enteros no negativos compatibles con la política de múltiplos de 5, que `score.teams` sea exactamente la suma de `scoreAwarded` por equipo y que el S de la última jugada coincida con el tablero actual. No reconstruye todos los tableros históricos.

**Motivo:** El marcador debe ser operativo sin replay, pero auditable contra un historial compacto. La última jugada terminal también debe puntuar antes del cierre conforme a R-017.

**Alternativas consideradas:** Reproducir toda la partida en cada validación; persistir `scoringTerms`; emitir un segundo evento de puntuación; calcular después de terminar; mantener schema v4 con resultados de jugada opcionales.

**Consecuencias:** `PASS` conserva `result: {}` y no altera score. `applyPlay` sigue siendo una primitiva topológica que produce un evento aún no enriquecido; su resultado puede validarse con `validateBoardState`, pero solo la composición reglamentaria satisface v5. `PLAY_SCORING_READY` es verdadero, mientras `SCORING_READY` y `gameplayReady` permanecen falsos porque todavía incluyen bonificación y resultado completo.

## DEC-034 — Cierre derivado, marcador terminal y schema v6

**Estado:** Aceptada.

**Decisión:** Al detectar salida o el cuarto pase, derivar una única terminación desde las manos y el puntaje de juego. `roundResult` persiste razón, sumas restantes por equipo, vencedor tradicional, bonificación, ganador por puntaje e indicador de empate; la salida conserva además jugador y equipo. `score.teams` pasa a ser el marcador final después de acreditar la bonificación una sola vez.

No se persisten mapas redundantes de puntaje de juego o puntaje final: el primero es la suma de `history[].result.scoreAwarded` y el segundo ya es `score.teams`. No se emite `ROUND_FINISHED`, porque el cierre es resultado de la última acción y no una acción reglamentaria adicional. Elevar el snapshot a schema v6.

**Motivo:** R-020 a R-026 exigen distinguir vencedor tradicional de ganador por puntaje y permiten empate. La forma mínima de v5 y su igualdad exacta `score = puntos históricos` ya no pueden representar ni validar esa semántica terminal.

**Alternativas consideradas:** Persistir `playScoreByTeam` y `finalRoundScoreByTeam`; añadir un evento sintético terminal; calcular ganador solo en consultas; conservar v5 con campos opcionales; usar `Math.round(a / 5)` sin expresar la convención de residuos.

**Consecuencias:** En `playing`, score continúa igualando los puntos de `PLAY_DOMINO`. En `finished`, equivale a esos puntos más `finalBonus` para `traditionalWinnerTeamId`. `remainingPipsByTeam`, ganador tradicional, bonificación y ganador final se validan contra manos, historial y marcador. `SCORING_READY`, `RULES_READY` y `gameplayReady` pasan a verdaderos exclusivamente para una ronda; multirronda, metas, variantes y renderers permanecen fuera de alcance.

## DEC-035 — Proyecciones puras y grafo de valores no autoritativo

**Estado:** Aceptada.

**Decisión:** Crear `src/js/game/projections/` como capa unidireccional que consume snapshots y consultas existentes. Exponer consultas pequeñas para grafo de valores, agrupación de extremos, legalidad por ficha y explicación de S, más `projectGraphView` como composición opcional. Mantener `getOpenEndTargets` como contrato base sin agrupar ni alterar.

Cada arista proyectada conserva `dominoId`, `placementId` y metadatos temporales derivados de `history`. Cada destino conserva `placementId + portId`; agruparlo por valor nunca elimina esa identidad. `getScoringProjection` reutiliza `getScoringTerms` y no publica puntos hipotéticos por observar el estado.

**Motivo:** GraphRenderer necesita datos cómodos sin conocer la forma interna del tablero ni reinterpretar reglas. A la vez, el colapso de todas las apariciones de un valor en un único vértice pierde línea principal, ramas, puertos y conexión elegida.

**Alternativas consideradas:** Hacer que el renderer recorra directamente `board`; persistir el grafo de valores; crear una megaestructura obligatoria; agrupar extremos solo por valor; calcular legalidad o S dentro del renderer; introducir coordenadas preventivas.

**Consecuencias:** El grafo de valores nunca valida jugadas ni reconstruye el tablero reglamentario. Las proyecciones son JSON serializables, descartables, inmutables respecto del snapshot y válidas también en `finished`. No cambia schema v6 ni `gameplayReady`. Esta decisión no implementó renderers; el primer prototipo visual se autoriza posteriormente en DEC-036.

## DEC-036 — Primer GraphRenderer SVG y controlador de intención

**Estado:** Aceptada.

**Decisión:** Implementar la primera vista jugable mediante SVG nativo y una geometría heptagonal estable generada por `GraphScene`. Materializar una arista sólida por ficha ordinaria, un lazo cerrado por chancho y una curva corta discontinua por cada target lógico. Mantener selección y foco como estado efímero de UI. Usar `InteractionController` para convertir únicamente un `START`, target individual o PASS ofrecido por las consultas públicas en `applyTurnAction`.

**Motivo:** SVG conserva identidad, hit area, accesibilidad y eventos por elemento sin instalar librerías. La escena pura permite probar estructura y geometría sin incorporar un DOM artificial a la suite. El controlador evita que el renderer reconstruya legalidad o mantenga una segunda copia del tablero.

**Alternativas consideradas:** Canvas único; librería de grafos; posicionamiento dinámico después de cada jugada; elegir solo por valor; mutar la escena tras una acción; probar píxeles con una dependencia DOM externa.

**Consecuencias:** La UI vuelve a proyectar cada snapshot aceptado. `START` no crea una curva ficticia, PASS depende de `getAvailableActions`, puntos visibles provienen del último evento y `finished` conserva el grafo sin acciones. No cambia schema v6 ni el motor reglamentario. La densidad de cruces, etiquetas, layout premium, replay, Modo Tradicional y selector permanecen pendientes.

## ESTUDIO-001 — Reversibilidad topológica entre Modo Grafo y Modo Tradicional

**Estado:** En estudio; no autorizado para implementación.

**Problema registrado:** El grafo de valores permite conocer qué fichas están jugadas, pero no contiene por sí solo la secuencia de placements, sus puertos ni el origen y recorrido de ramas. Una misma colección de aristas puede corresponder a tableros lógicos diferentes.

**Hallazgo actual:** El snapshot v6 no perdió esa información. `mainLine.placementIds`, `connections`, puertos canónicos, `specialDoublePlacementIds` y las ramas derivadas permiten reconstruir de forma unívoca la topología tradicional. Solo geometría, rotación y espejo permanecen indeterminados, como corresponde al renderer.

**Alternativas por comparar:** Índices ordinales; coordenadas firmadas alrededor de una ficha ancla; vecinos explícitos; pares `(t,±d)` para ramas; coordenadas estructuradas con `originPlacementId + originPortId + depth`; índices permanentes frente a inspección visual bajo demanda.

**Restricción provisional:** No persistir metadata ni cambiar schema por esta cuestión. Si se autoriza, comenzar por una proyección topológica pura y demostrar que no participa en legalidad. El análisis completo está en [`reversibilidad-grafo-tradicional.md`](reversibilidad-grafo-tradicional.md).
