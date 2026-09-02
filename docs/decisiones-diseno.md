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

**Estado:** Primera proyección materializada; reversibilidad visual completa todavía en estudio.

**Problema registrado:** El grafo de valores permite conocer qué fichas están jugadas, pero no contiene por sí solo la secuencia de placements, sus puertos ni el origen y recorrido de ramas. Una misma colección de aristas puede corresponder a tableros lógicos diferentes.

**Hallazgo actual:** El snapshot v6 no perdió esa información. `mainLine.placementIds`, `connections`, puertos canónicos, `specialDoublePlacementIds` y las ramas derivadas permiten reconstruir de forma unívoca la topología tradicional. Solo geometría, rotación y espejo permanecen indeterminados, como corresponde al renderer.

**Alternativas por comparar:** Índices ordinales; coordenadas firmadas alrededor de una ficha ancla; vecinos explícitos; pares `(t,±d)` para ramas; coordenadas estructuradas con `originPlacementId + originPortId + depth`; índices permanentes frente a inspección visual bajo demanda.

**Restricción vigente:** No persistir metadata ni cambiar schema por esta cuestión. La proyección topológica implementada demuestra que no necesita participar en legalidad. Coordenadas, vecinos y reconstrucción visual ampliada siguen pendientes. El análisis completo está en [`reversibilidad-grafo-tradicional.md`](reversibilidad-grafo-tradicional.md).

## ESTUDIO-002 — Legibilidad topológica del primer GraphRenderer

**Estado:** Primera capa resuelta; ampliaciones todavía en estudio.

**Problema registrado:** Una ronda completa confirma que reconocer las fichas del grafo no basta para reconstruir mentalmente línea principal, ramas, raíces ni función topológica de los chanchos. El problema se agrava con K alto y grafos densos.

**Hallazgo actual:** El `board` ya contiene todos los datos. La primera proyección clasifica ahora cada arista/lazo por región, posición, raíz y capacidad especial. “Principal/rama” y “especial/ordinario” permanecen como ejes independientes: con K agotado puede existir un chancho ordinario en la línea principal.

**Alternativas por comparar:** Estilo topológico permanente; inspección de secuencia al seleccionar; panel auxiliar jerárquico; modo opcional con etiquetas/coordenadas. La recomendación provisional es una combinación progresiva de las tres primeras y dejar las coordenadas como ayuda opcional.

**Restricción vigente:** No modificar reglas, snapshot ni schema. GraphRenderer consume datos derivados sin inspeccionar `board` ni decidir legalidad. El panel completo y las etiquetas opcionales siguen fuera de esta primera capa. Véase [`ux-topologia-modo-grafo.md`](ux-topologia-modo-grafo.md).

## DEC-037 — Proyección topológica e inspección progresiva

**Estado:** Aceptada.

**Decisión:** Exponer `getBoardTopologyProjection(state)` como consulta pura derivada de línea, placements, conexiones, puertos, lista especial y ramas. Componerla en `projectGraphView`; GraphRenderer no lee `board`. Mantener inspección en `InteractionController` como estado efímero que identifica solo un `placementId` y se limpia después de una acción.

La vista diferencia principal/rama con trazo continuo/segmentado, añade un símbolo gráfico a chanchos especiales, muestra `Especiales: s/effectiveK` y, bajo selección, resalta la estructura completa más la raíz lateral. El inspector explica los tres roles de chancho y su capacidad.

**Motivo:** La prueba manual confirmó que el grafo de valores era jugable pero no hacía visible la topología que ya conserva el snapshot. Una capa derivada resuelve clasificación e inspección sin duplicar estado ni convertir el grafo en una mesa tradicional.

**Alternativas consideradas:** Estilos permanentes únicamente; índices globales; panel estructural completo; lectura directa de `board` desde UI; persistir región/coordenadas; rediseño premium simultáneo.

**Consecuencias:** No cambia schema v6, motor, reglas, legalidad, puntuación ni turnos. Panel completo, coordenadas visibles, replay, Modo Tradicional y refinamiento premium siguen pendientes.

## DEC-038 — Identidad descartable de estructuras en extremos abiertos

**Estado:** Sustituida en su convención visual por DEC-039; identidad exacta preservada.

**Decisión:** Derivar `P` para la línea principal y reservar `A`, `B`, `C`… para cada par `originPlacementId + originPortId` lateral. El orden se obtiene de `specialDoublePlacementIds` y, dentro de cada chancho, `branch:1` antes de `branch:2`. Repetir el código lateral en el chancho raíz, todas las fichas de la rama y su target terminal. Mantener todos los extremos visibles en estado neutral; con ficha seleccionada, destacar los legales, mostrar índice individual y atenuar los incompatibles.

**Motivo:** Un target identificado solo por valor y región no explica qué rama concreta continuará, y ocultarlo visualmente hasta seleccionar una ficha elimina una señal que la mesa tradicional entrega de forma permanente.

**Alternativas consideradas:** Colores exclusivos por rama; numerar solo targets legales; asignar etiquetas al iniciar la rama; animar continuamente todos los extremos; persistir la letra; hacer que GraphRenderer recorra puertos del board.

**Consecuencias:** La identificación no depende solo del color y permanece estable aunque la rama todavía esté vacía. `placementId + portId` continúa siendo la identidad reglamentaria enviada al motor; `P/A/B…` es únicamente presentación derivada. No cambian snapshot, schema, motor, reglas, puntuación ni turnos. En grafos densos y teléfonos todavía debe evaluarse el tamaño final de badges antes del refinamiento premium.

## DEC-039 — Familia visual por chancho especial y gramática mínima

**Estado:** Aceptada.

**Decisión:** Mantener `P` para los dos extremos de la línea principal y asignar una sola familia visual `A`, `B`… a cada chancho especial, en el orden de `specialDoublePlacementIds`. Sus brazos `branch:1` y `branch:2` comparten letra y acento, pero conservan `structureId`, `armIndex`, `originPortId` y target exacto independientes. Un chancho ordinario, sea lateral o principal por K agotado, no crea familia.

En reposo, mostrar aristas/lazos sin etiquetas numéricas redundantes, no repetir la letra en fichas interiores y mantener todas las colitas identificadas. Usar trazo continuo para principal, segmentado para ramas, contorno hueco/punteado para brazo potencial y relleno suave para brazo iniciado. Los números de opción aparecen solo al elegir entre varios targets compatibles del mismo valor.

La inspección de familia puede iniciarse desde su arista, colita o badge raíz. Resalta la unión de ambos brazos ocupados, su chancho raíz y sus extremos; el estado continúa siendo efímero del controlador y nunca se persiste.

**Motivo:** Las pruebas reales en PC y teléfono mostraron que la convención de una letra por puerto y su repetición sobre cada arista agregaba ruido. Para el Modo Grafo importa más reconocer valores abiertos, capacidad de ramificación y estructura que reconstruir permanentemente la mesa tradicional.

**Alternativas consideradas:** Conservar una letra por brazo; mantener etiquetas `N·M`; repetir letras en cada ficha; usar color exclusivo por familia; mostrar siempre índices o `×q`; adoptar coordenadas topológicas visibles.

**Consecuencias:** La proyección topológica incorpora familias y brazos derivados sin cambiar snapshot v6. GraphRenderer sigue sin leer `board`; acciones continúan usando `placementId + portId`. La reconstrucción exacta quedó disponible para el bloque tradicional posterior, formalizado en DEC-040. La configuración de `n` con 5 predeterminado continúa pendiente.

## DEC-040 — Proyección tradicional descartable y conmutador no reglamentario

**Estado:** Aceptada.

**Decisión:** Derivar `getTraditionalBoardProjection(state)` exclusivamente del board validado. La línea conserva el orden de `mainLine.placementIds` y orienta cada ficha por la conexión anterior/siguiente; cada brazo conserva su origen `placementId + branch:*`, conexiones y placements ordenados desde la raíz hasta el terminal. `projectRoundView` reúne los datos comunes y las fachadas específicas añaden solo su representación de tablero.

TraditionalRenderer convierte esa proyección en una geometría HTML/CSS descartable: principal horizontal, chanchos principales transversales y brazos superior/inferior. `ViewModeController` solo conserva `graph | traditional`; un único `InteractionController` mantiene la selección y envía los mismos targets exactos a `applyTurnAction`.

**Motivo:** El board v6 ya conserva toda la topología necesaria y el grafo de valores no debe usarse como fuente de la mesa. Separar proyección, geometría y preferencia permite alternar sin recrear partida ni duplicar legalidad.

**Alternativas consideradas:** Reconstruir desde aristas SVG; persistir coordenadas; duplicar un controlador por renderer; limpiar siempre la selección; simular una mesa con giros físicos completos desde la primera versión; introducir una librería de layout.

**Consecuencias:** No cambia motor, reglas, schema v6, historial, score ni persistencia. Los dos modos comparten acciones, puntuación, turno y resultado. La primera mesa prioriza fidelidad topológica y scroll local; quedan pendientes giros adaptativos, zoom y acabado premium.

## DEC-041 — Orientación física por puertos y cámara tradicional mínima

**Estado:** Aceptada.

**Decisión:** Mantener en la proyección tradicional el orden raíz→terminal y exponer también el puerto de origen de cada brazo. `TraditionalScene` asigna `start/end` a caras físicas según la dirección descartable: izquierda→derecha en principal, raíz abajo/exterior arriba en el brazo superior y raíz arriba/exterior abajo en el inferior. Cada conexión proyectada conserva sus dos caras y exige que ambas coincidan con su valor lógico.

La vista tradicional elimina códigos `P/A`, familias cromáticas, resumen de K, `×4` y valores dentro de objetivos externos. Los extremos son sockets próximos a la mitad libre; solo una selección con destinos compatibles repetidos añade índices temporales. La cámara calcula una escala de ajuste limitada por un mínimo legible, centra la superficie y ofrece viewport interno, desplazamiento táctil, arrastre con mouse y botón de recuperación.

GraphRenderer conserva su gramática estratégica, pero unifica el distintivo del chancho especial en el lazo reforzado y el único badge de familia; elimina el símbolo de cuatro brazos y los dos indicadores auxiliares alrededor de cada raíz.

**Motivo:** La prueba real mostró dos problemas independientes: una cadena lógica correcta podía invertir físicamente una ficha del brazo superior, y ambas vistas acumulaban metadata que competía con fichas y targets. La orientación debía depender de conexiones, no de heurísticas geométricas; la simplificación debía preservar la diferencia de propósito entre mesa física y grafo estratégico.

**Alternativas consideradas:** Persistir flips o coordenadas; inferir orientación por los números del dominó; mantener códigos estructurales en la mesa; escalar siempre hasta encajar aunque las fichas quedaran diminutas; incorporar una librería de pan/zoom.

**Consecuencias:** No cambia snapshot v6, motor, reglas, historial ni persistencia. El ajuste automático puede conservar scroll interno cuando una mesa densa alcanza el mínimo legible; zoom gestual, giros para cadenas largas y refinamiento premium siguen pendientes.

## DEC-042 — Repetición local como partidas independientes

**Estado:** Aceptada.

**Decisión:** Incorporar un `LocalGameSessionController` efímero por encima de `InteractionController`. En configuración conserva `K=0…7` y la vista inicial; al pulsar Jugar llama a la fábrica pública `createMatch` con una nueva fuente de aleatoriedad y crea un controlador de interacción nuevo. Tras un estado `finished`, «Jugar otra» repite la operación conservando K y la vista actualmente preferida, mientras «Cambiar configuración» descarta el snapshot y vuelve al formulario.

**Motivo:** El prototipo necesitaba un ciclo completo de uso sin confundir la repetición con un sistema de rondas acumuladas. Reemplazar el snapshot asegura que tablero, manos, turno, pases, score, resultado, selección, inspección y mensajes no se filtren entre partidas.

**Alternativas consideradas:** Recargar la página; mutar el snapshot terminal hasta hacerlo inicial; agregar una acción reglamentaria `NEW_ROUND`; introducir ahora RoundState/MatchState; persistir preferencias dentro del estado del motor.

**Consecuencias:** No cambia schema v6, motor, reglas, puntuación ni renderers. `createMatch` conserva por ahora su nombre técnico aunque cada invocación represente la única ronda de una partida independiente. Multirronda, acumulados, metas y la separación formal RoundState/MatchState continúan pendientes de especificación.

## DEC-043 — Jerarquía compacta y feedback derivado

**Estado:** Aceptada.

**Decisión:** Presentar turno, marcador y S como una sola banda compacta; disponer después tablero, mano y cantidades restantes en ese orden. Las cantidades usan chips y distinguen «Tu mano» de las cantidades rivales sin revelar fichas. K permanece en la banda de sesión, por lo que el resumen `Especiales: s/K` deja de ocupar el SVG.

La cámara tradicional calcula sobre límites más próximos al contenido y nunca baja de una escala mínima legible; si el conjunto no cabe, mantiene pan/scroll interno. El fondo pierde contraste. GraphRenderer conserva vértices, trazos y extremos estratégicos, pero reduce el distintivo raíz y elimina información global duplicada.

`GameFeedback` deriva del último evento proyectado el equipo/puntos y, mediante la topología ya proyectada, reconoce únicamente la primera ficha de un brazo. `main.js` recuerda la última `sequence` presentada para no repetir animaciones al seleccionar, inspeccionar o cambiar de renderer. Este estado es exclusivamente efímero.

**Motivo:** Las pruebas a 100% en escritorio y teléfono mostraron que tarjetas, sidebar y una cámara demasiado conservadora alejaban la mano del tablero. Además, acciones correctas carecían de confirmación visual breve.

**Alternativas consideradas:** Hacer sticky la mano; ocultar el HUD completo; recalcular puntos o ramas en el renderer; mostrar siempre el feedback; encajar toda mesa aunque las fichas fueran diminutas; mantener el resumen de especiales dentro del grafo.

**Consecuencias:** No cambia snapshot v6, proyecciones reglamentarias, reglas, schema ni persistencia. El feedback usa únicamente datos ya derivados y respeta movimiento reducido. Sticky avanzado, zoom gestual y acabado premium siguen pendientes.

## DEC-044 — Geometría responsiva, capas de mesa y mini-fichas de mano

**Estado:** Aceptada.

**Decisión:** Mantener dos geometrías descartables del Grafo: una compacta para teléfono y otra ancha para paneles de al menos 720 px. Ambas conservan los mismos siete valores, aristas, lazos y targets; solo cambian `viewBox`, centro y radios. En la mesa tradicional, reducir el lienzo mínimo artificial y permitir ampliación hasta `1.35×` cuando el contenido real cabe, sin rebajar el mínimo legible de estados densos.

Cada conector tradicional termina en el punto exacto de la cara física de ambas fichas y la superficie aísla las capas en el orden conexión, ficha, extremo y control. Mesa y mano comparten una única serialización de puntos. La mano representa cada opción como mini-ficha táctil; solo muestra cantidad cuando existen dos o más destinos y conserva toda la información en el nombre accesible.

**Motivo:** A 100% el Grafo casi cuadrado desaprovechaba paneles anchos, la cámara reservaba vacío alrededor de mesas tempranas y los conectores podían atravesar visualmente el cuerpo de una ficha. La mano basada en tarjetas competía con el tablero y repetía información obvia.

**Consecuencias:** Solo cambian escenas, renderers, CSS y estado efímero de presentación. Motor, legalidad, targets canónicos, snapshot v6, schema, persistencia, puntuación y K permanecen intactos. Una mesa densa sigue usando pan interno al alcanzar el mínimo legible; zoom gestual y refinamiento premium continúan pendientes.

## DEC-045 — Presentación única de puntuación y privacidad por entrega local

**Estado:** Aceptada.

**Decisión:** Exponer `PLAY_SCORING_POLICY` y componer una proyección pura `scoringPresentation` con política, divisor, términos explicables, expresión, S y resolución de la última jugada. GraphRenderer y TraditionalRenderer reciben esa misma resolución únicamente durante el feedback de una secuencia nueva; resaltan placements/puertos proyectados, no todos los extremos abiertos. El panel permanente conserva solo `S` y un detalle desplegable.

`LocalGameSessionController` oculta mano, jugadas legales, selección y PASS hasta que el jugador actual pulsa «Mostrar mi mano». La revelación se borra al cambiar el jugador, terminar o crear otra partida. El tablero y los datos públicos siguen visibles; el snapshot no cambia. En terminal, la mano y PASS desaparecen y el resultado prioriza ganador por puntaje o empate sobre la explicación tradicional.

**Motivo:** La puntuación reglamentaria funcionaba pero no se percibía como momento central, y una partida local compartida revelaba automáticamente la mano siguiente. Una proyección común evita que cada renderer replique reglas o codifique el divisor. La barrera local resuelve privacidad básica sin convertirla en networking ni persistencia.

**Consecuencias:** La política activa sigue siendo exclusivamente `DIVISIBLE/5`; `enabled: false` solo define cómo callar la presentación futura y no habilita «Sin divisibilidad». La base de R-023 queda separada del divisor de jugada hasta decidir formalmente la relación con `n`. No cambian schema v6, historial, score, reglas, K ni persistencia. Selector `n`, `n≠5`, multirronda, replay y multiplayer remoto siguen pendientes.
