# Arquitectura

## Objetivo

La arquitectura busca que una misma implementación de reglas pueda usarse en tests, una interfaz local, herramientas de replay y, más adelante, un servidor autoritativo. Las Fases 0 y 1 cerraron contratos y motor; la Fase 2 mantiene proyecciones puras separadas de las geometrías de Tradicional, Puertos y Grafo.

## Capas y dirección de dependencias

```text
index.html
    │
    ▼
UI / controladores ───────────────┐
    │                             │
    ▼                             ▼
API pública de dominio      adaptadores futuros
    │                       persistencia / red
    ├──► proyecciones puras ──────┤
    │                             │
    ▼                             │
reglas + transiciones ◄───────────┘
    │
    ▼
modelo de estado + tablero lógico
```

La dirección importante es hacia el dominio. El motor nunca importa módulos de `ui/`, ni conoce `document`, `window`, HTML, CSS, animaciones, píxeles o coordenadas. La UI puede importar la API pública del motor y representar snapshots, pero no escribir directamente en ellos.

## Tablero, incidencias y grafo de valores

“Grafo” puede referirse a dos estructuras distintas:

- el **grafo lógico del tablero**, formado por colocaciones, puertos y conexiones y usado por el motor;
- el **grafo de incidencias de Puertos**, proyección intermedia con siete macro-nodos, puertos canónicos e identidad de continuidad;
- el **grafo de valores**, formado por los vértices `0–6` y las fichas como aristas/lazos, usado por GraphRenderer.

Ninguna de las dos proyecciones visuales reemplaza el estado normativo. El grafo de valores necesita una superposición de extremos individualizados para recuperar destinos que el colapso por valor no distingue. Puertos conserva qué incidencias se emparejan mediante puentes internos, pero sigue dependiendo del board para ser construido y nunca valida acciones por sí mismo.

## Arquitectura de renderers

```text
                    motor de una ronda
                            │
                       snapshot v6
                            │
                   proyecciones puras
                            │
          ┌─────────────────┬─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
TraditionalRenderer    PortRenderer      GraphRenderer
```

TraditionalRenderer es la vista inicial de juego. GraphRenderer permanece disponible como lectura analítica/matemática y PortRenderer como experimento de incidencias del mismo snapshot. Alternar mediante `ViewModeController` solo cambia una preferencia efímera de UI; nunca `config`, `board`, `history`, `score` ni turno.

`projectRoundView` concentra mano, legalidad, puntuación, participantes, turno y resultado compartidos. Incluye `scoringPresentation`, una proyección descartable que expone política, divisor, términos, expresión, S y la resolución de la última jugada puntuada; la UI no aplica `%`, división ni reglas de chanchos. `getStrategicTargetProjections` simula mediante `applyTurnAction` cada target legal de una ficha y deriva puntuación, extremos resultantes y apertura lateral sin mutar el snapshot. Es una API bajo demanda para ayudas futuras: los renderers normales no revelan ese resultado antes de jugar. `projectGraphView` añade grafo de valores/topología visual; `projectPortView` añade siete macro-nodos, puertos ordinarios, hilos, puentes y hubs; `projectTraditionalView` añade `getTraditionalBoardProjection`, que ordena la línea y cada brazo con sus puertos. `TraditionalScene` asigna esos puertos a caras físicas, `PortScene` distribuye incidencias dentro de un heptágono estable y `GraphScene` elige una geometría compacta o ancha. Geometría, hit areas, cámara, capas, rotaciones y trazados pertenecen exclusivamente a estas escenas/renderers. Véanse [`modos-visualizacion.md`](modos-visualizacion.md), [`modo-puertos.md`](modo-puertos.md) y [`modo-grafo.md`](modo-grafo.md).

## Responsabilidades

### `src/js/game/model/`

Contiene representaciones de datos serializables: fichas, jugadores, equipos, tablero y estado completo. No decide legalidad, turnos ni puntuación.

### `src/js/game/engine/`

Es el lugar de las reglas puras y las transiciones de juego. El Bloque 2 implementa consultas de puertos, ramas, destinos y jugadas legales, más la primitiva topológica `applyPlay(state, action)`. El Bloque 3 añade `applyTurnAction(state, action)`, que impone el jugador actual, coordina `PASS` y avanza el ciclo antihorario. El Bloque 4 incorpora términos de S, múltiplos de 5 y actualización del marcador. El Bloque 5 añade `RoundCompletion`, que deriva totales restantes, vencedor tradicional, bonificación y resultado final sin introducir multirronda.

La dependencia interna queda orientada así:

```text
API reglamentaria (`applyTurnAction` / `getAvailableActions`)
    │
    ▼
coordinación de turno y validación de ronda
    │
    ├──────────────► política de puntuación (`Scoring`)
    ├──────────────► cierre derivado (`RoundCompletion`)
    │                         │
    ▼                         │
primitiva topológica `applyPlay`
    │                         │
    └──────────────┬──────────┘
                   ▼
       consultas, puertos, conexiones y tablero lógico
```

`applyPlay` permanece exportada para tests y herramientas de bajo nivel, pero la UI no debe usarla como transición de juego.

### `src/js/game/projections/`

Contiene transformaciones puras y descartables sobre snapshots validados. Depende de consultas del motor; el motor no depende de esta capa. `ValueGraphProjection` crea los siete vértices y aristas/lazos, `PortGraphProjection` conserva incidencias y continuidad dentro de esos siete valores, `OpenEndProjection` agrupa destinos, `LegalPlayProjection` organiza acciones por ficha, `ScoringProjection` explica S y las fachadas de vista componen cada renderer.

La capa no persiste estado, no valida legalidad por una ruta propia y no contiene coordenadas, DOM, Canvas, SVG ni animaciones. El grafo de valores jamás se usa como entrada de `applyTurnAction`, `getLegalPlays` o validadores del tablero.

### `src/js/game/setup/`

Contiene la preparación pura y atómica de una partida: participantes, ciclo de asientos, K, mezcla, reparto, jugador inicial y validación del snapshot recién creado. No contiene colocaciones ni transiciones de turno. La aleatoriedad entra como dependencia explícita para que los tests sean deterministas.

### `src/js/game/errors/`

Define errores de dominio con código y detalles serializables. Permite que UI, tests y futuros adaptadores distingan una entrada inválida sin depender del texto del mensaje.

### `src/js/game/index.js`

Es la fachada pública del dominio y sus proyecciones. La UI y futuros adaptadores deberían depender de este punto y no de detalles internos, salvo tests unitarios específicos.

### `src/js/ui/`

Contiene `GraphScene`/`GraphRenderer`, `PortScene`/`PortRenderer`, `TraditionalScene`/`TraditionalRenderer`, renderers de paneles, `GameFeedback`, `InteractionController`, `ViewModeController` y `LocalGameSessionController`. Las escenas transforman proyecciones en geometría descartable sin leer `board`; el controlador de interacción selecciona una acción canónica de `getAvailableActions` y conserva selección/inspección efímeras. `GameFeedback` presenta la resolución ya proyectada como términos → S → divisibilidad → puntos y reconoce aperturas de rama desde la topología, sin recalcular reglas. El controlador de vista solo conserva `graph | ports | traditional`. El coordinador local muestra configuración, llama a `createMatch`, reemplaza íntegramente el controlador/snapshot al iniciar otra partida independiente y mantiene la revelación de mano como privacidad efímera; no es un MatchState. Coordenadas, ángulos, escala mínima, scroll/pan, estilos, selección efímera, privacidad de mano, secuencia de feedback y foco pertenecen aquí.

### `src/js/utils/`

Utilidades técnicas sin reglas de dominio. No debe convertirse en un lugar para ocultar decisiones normativas.

### Adaptadores futuros

Persistencia y red se añadirán en directorios propios cuando exista alcance definido. Transformarán JSON o mensajes a contratos públicos del motor; no incorporarán reglas paralelas.

### Coordinación Round / Match futura

El snapshot v6 representa el ciclo único desde reparto hasta resultado final. «Jugar otra» descarta ese snapshot y crea otro independiente: no lo convierte en una ronda numerada ni conserva acumulados. Si se aprueban series o metas acumuladas, un coordinador de match distinto envolverá el motor de ronda y conservará acumulados sin introducirlos en Board o Rules. La propuesta está en [`modelo-round-match.md`](modelo-round-match.md); no requiere un refactor actual.

## Flujo de una acción reglamentaria

1. La UI muestra un snapshot recibido.
2. El usuario expresa una intención, por ejemplo jugar una ficha en un puerto lógico.
3. `InteractionController` elige una acción expuesta por `getAvailableActions` sin coordenadas.
4. `applyTurnAction` valida snapshot, fase, jugador actual y legalidad.
5. Para `PLAY_DOMINO`, compone `applyPlay`, deriva S sobre el tablero resultante, calcula puntos, actualiza el equipo del actor y enriquece el mismo evento; para `PASS`, registra directamente el evento canónico sin puntos.
6. La transición reinicia o incrementa pases y detecta salida o tranque. Si termina, deriva el resultado y acredita la bonificación; si continúa, avanza con `getCounterclockwiseSuccessor`.
7. El motor devuelve un snapshot validado o un error explícito sin mutar el estado original.
8. La acción aceptada aparece exactamente una vez en el historial.
9. La UI vuelve a renderizar; efectos y animaciones observan la transición, pero no la deciden.

`applyPlay` continúa terminando tras el paso topológico e histórico: no avanza turno ni toca pases o marcador. `applyTurnAction` completa la acción reglamentaria y enriquece la entrada recién creada con `openEndsSum` y `scoreAwarded`; no agrega un segundo evento. La capa superior crea directamente solo los eventos `PASS`.

### Orden de transición

`PLAY_DOMINO` sigue: validar ronda → validar turno y jugada disponible → aplicar topología → calcular S → calcular puntos → actualizar `score.teams` → reiniciar pases → detectar mano vacía → si termina, derivar cierre y bonificar; si no, avanzar jugador/turno → validar resultado.

`PASS` sigue: validar ronda → validar turno y ausencia de jugadas → registrar `PASS` → incrementar pases → al cuarto derivar cierre y bonificar; antes del cuarto, avanzar jugador/turno → validar resultado.

## Pureza y mutabilidad

Se favorecerán funciones puras y actualizaciones inmutables. No es requisito congelar recursivamente cada snapshot, pero sí evitar mutaciones compartidas y comprobar invariantes en los límites. Esta estrategia simplifica tests, historial, sincronización y comparación de estados.

## Capacidades no implementadas

Una capacidad todavía no implementada debe fallar de forma explícita o no estar expuesta. Nunca debe responder “válido” o “0 puntos” como valor provisional, porque ese valor podría confundirse con comportamiento real. El motor de una ronda, sus proyecciones y las primeras versiones funcionales de ambos renderers están completos; permanecen fuera múltiples rondas, metas acumuladas, variantes `n ≠ 5`, panel estructural completo, giros físicos avanzados, zoom y refinamiento visual premium.

## GitHub Pages y ubicación de `index.html`

La estructura sugerida colocaba `index.html` dentro de `src/`. Se ha colocado en la raíz porque GitHub Pages puede publicar directamente la raíz de una rama y porque no hay proceso de build. El resto del código continúa en `src/`. Los enlaces son relativos para funcionar tanto en `localhost` como bajo el subdirectorio de un repositorio.

No se añade un workflow de despliegue: la configuración de Pages puede seleccionar la rama y la carpeta raíz. Si en el futuro aparece un bundler o una salida generada, esta decisión deberá revisarse.

## Herramientas

- JavaScript moderno con módulos ES.
- CSS dividido por responsabilidad.
- `node:test` y `node:assert` para tests sin navegador.
- Servidor HTTP local escrito con módulos estándar de Node.

No hay framework, bundler, transpiler ni dependencia externa. Esto reduce superficie de mantenimiento en la Fase 0 y conserva la publicación estática. Una dependencia futura requerirá una decisión registrada con necesidad, alternativas y coste.

## Estructura adoptada

```text
.
├── index.html
├── src/
│   ├── css/
│   ├── js/
│   │   ├── game/
│   │   │   ├── engine/
│   │   │   ├── errors/
│   │   │   ├── model/
│   │   │   ├── projections/
│   │   │   └── setup/
│   │   ├── ui/
│   │   └── utils/
│   └── assets/
├── tests/
├── scripts/
├── docs/
└── prototypes/
```

La separación entre `game/model`, `game/setup`, `game/engine` y `game/projections` hace visible la diferencia entre datos, inicialización, reglas y vistas lógicas descartables. Se prefieren fábricas de datos serializables a instancias de clases con prototipo; la justificación está en DEC-006.

## Invariantes

La lista normativa de invariantes técnicos está en [`invariantes.md`](invariantes.md). Los tests de fronteras vigilan que el motor siga siendo importable en Node y no incorpore APIs del navegador.
