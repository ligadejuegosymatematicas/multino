# Arquitectura

## Objetivo

La arquitectura busca que una misma implementación de reglas pueda usarse en tests, una interfaz local, herramientas de replay y, más adelante, un servidor autoritativo. La Fase 0 cerró las fronteras y contratos; la Fase 1 implementa el motor por bloques verificables.

## Capas y dirección de dependencias

```text
index.html
    │
    ▼
UI / controladores ───────────────┐
    │                             │
    ▼                             ▼
API pública del motor       adaptadores futuros
    │                       persistencia / red
    ▼                             │
reglas + transiciones ◄───────────┘
    │
    ▼
modelo de estado + tablero lógico
```

La dirección importante es hacia el dominio. El motor nunca importa módulos de `ui/`, ni conoce `document`, `window`, HTML, CSS, animaciones, píxeles o coordenadas. La UI puede importar la API pública del motor y representar snapshots, pero no escribir directamente en ellos.

## Dos grafos, una frontera explícita

“Grafo” puede referirse a dos estructuras distintas:

- el **grafo lógico del tablero**, formado por colocaciones, puertos y conexiones y usado por el motor;
- el **grafo de valores**, formado por los vértices `0–6` y las fichas como aristas/lazos, usado por GraphRenderer.

El grafo de valores es una proyección: no reemplaza ni simplifica el estado normativo. En particular, necesita una superposición de extremos individualizados para recuperar destinos que el colapso por valor no distingue.

## Arquitectura de renderers

```text
                    motor de una ronda
                            │
                       snapshot v5
                            │
                   proyecciones puras
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
          GraphRenderer         TraditionalRenderer
```

GraphRenderer es la vista predeterminada prevista. TraditionalRenderer representa el mismo snapshot como fichas y cadenas. Alternar entre ambos solo cambia preferencias y estado efímero de UI; nunca `config`, `board`, `history` ni `score`.

La proyección de extremos, jugadas legales y puntuación pertenece a funciones puras cercanas al motor. La geometría, hit areas, animaciones y agrupaciones visuales pertenecen al renderer. Véanse [`modos-visualizacion.md`](modos-visualizacion.md) y [`modo-grafo.md`](modo-grafo.md).

## Responsabilidades

### `src/js/game/model/`

Contiene representaciones de datos serializables: fichas, jugadores, equipos, tablero y estado completo. No decide legalidad, turnos ni puntuación.

### `src/js/game/engine/`

Es el lugar de las reglas puras y las transiciones de juego. El Bloque 2 implementa consultas de puertos, ramas, destinos y jugadas legales, más la primitiva topológica `applyPlay(state, action)`. El Bloque 3 añade `applyTurnAction(state, action)`, que impone el jugador actual, coordina `PASS`, avanza el ciclo antihorario y produce terminación básica. El Bloque 4 incorpora `getScoringTerms`, suma S, múltiplos de 5 y actualización del marcador dentro de esa transición superior. Bonificación y resultado definitivo continúan declarados como no implementados.

La dependencia interna queda orientada así:

```text
API reglamentaria (`applyTurnAction` / `getAvailableActions`)
    │
    ▼
coordinación de turno y validación de ronda
    │
    ├──────────────► política de puntuación (`Scoring`)
    │                         │
    ▼                         │
primitiva topológica `applyPlay`
    │                         │
    └──────────────┬──────────┘
                   ▼
       consultas, puertos, conexiones y tablero lógico
```

`applyPlay` permanece exportada para tests y herramientas de bajo nivel, pero la UI no debe usarla como transición de juego.

### `src/js/game/setup/`

Contiene la preparación pura y atómica de una partida: participantes, ciclo de asientos, K, mezcla, reparto, jugador inicial y validación del snapshot recién creado. No contiene colocaciones ni transiciones de turno. La aleatoriedad entra como dependencia explícita para que los tests sean deterministas.

### `src/js/game/errors/`

Define errores de dominio con código y detalles serializables. Permite que UI, tests y futuros adaptadores distingan una entrada inválida sin depender del texto del mensaje.

### `src/js/game/index.js`

Es la fachada pública del motor. La UI y futuros adaptadores deberían depender de este punto y no de detalles internos, salvo tests unitarios específicos.

### `src/js/ui/`

Contiene renderers y el controlador de interacción. Traduce eventos del usuario a solicitudes de acción y snapshots a elementos visuales. Las coordenadas y rotaciones pertenecen aquí.

### `src/js/utils/`

Utilidades técnicas sin reglas de dominio. No debe convertirse en un lugar para ocultar decisiones normativas.

### Adaptadores futuros

Persistencia y red se añadirán en directorios propios cuando exista alcance definido. Transformarán JSON o mensajes a contratos públicos del motor; no incorporarán reglas paralelas.

### Coordinación Round / Match futura

El snapshot v5 continúa representando el ciclo único desde reparto hasta salida o tranque. Si se aprueban series o metas acumuladas, un coordinador de match envolverá ese motor de ronda y conservará acumulados sin introducirlos en Board o Rules. La propuesta está en [`modelo-round-match.md`](modelo-round-match.md); no requiere un refactor actual.

## Flujo de una acción reglamentaria

1. La UI muestra un snapshot recibido.
2. El usuario expresa una intención, por ejemplo jugar una ficha en un puerto lógico.
3. `InteractionController` elige una acción expuesta por `getAvailableActions` sin coordenadas.
4. `applyTurnAction` valida snapshot, fase, jugador actual y legalidad.
5. Para `PLAY_DOMINO`, compone `applyPlay`, deriva S sobre el tablero resultante, calcula puntos, actualiza el equipo del actor y enriquece el mismo evento; para `PASS`, registra directamente el evento canónico sin tocar el score.
6. La transición reinicia o incrementa pases, detecta salida o tranque y, si continúa, avanza con `getCounterclockwiseSuccessor`.
7. El motor devuelve un snapshot validado o un error explícito sin mutar el estado original.
8. La acción aceptada aparece exactamente una vez en el historial.
9. La UI vuelve a renderizar; efectos y animaciones observan la transición, pero no la deciden.

`applyPlay` continúa terminando tras el paso topológico e histórico: no avanza turno ni toca pases o marcador. `applyTurnAction` completa la acción reglamentaria y enriquece la entrada recién creada con `openEndsSum` y `scoreAwarded`; no agrega un segundo evento. La capa superior crea directamente solo los eventos `PASS`.

### Orden de transición

`PLAY_DOMINO` sigue: validar ronda → validar turno y jugada disponible → aplicar topología → calcular S → calcular puntos → actualizar `score.teams` → reiniciar pases → detectar mano vacía → terminar o avanzar jugador/turno → validar resultado.

`PASS` sigue: validar ronda → validar turno y ausencia de jugadas → registrar `PASS` → incrementar pases → terminar al cuarto o avanzar jugador/turno → validar resultado.

## Pureza y mutabilidad

Se favorecerán funciones puras y actualizaciones inmutables. No es requisito congelar recursivamente cada snapshot, pero sí evitar mutaciones compartidas y comprobar invariantes en los límites. Esta estrategia simplifica tests, historial, sincronización y comparación de estados.

## Capacidades no implementadas

Una capacidad todavía no implementada debe fallar de forma explícita o no estar expuesta. Nunca debe responder “válido” o “0 puntos” como valor provisional, porque ese valor podría confundirse con comportamiento real. En el estado actual permanecen pendientes bonificación, suma de fichas restantes, vencedor tradicional del tranque y resultado definitivo.

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
│   │   │   └── setup/
│   │   ├── ui/
│   │   └── utils/
│   └── assets/
├── tests/
├── scripts/
├── docs/
└── prototypes/
```

La separación entre `game/model`, `game/setup` y `game/engine` hace visible la diferencia entre datos, inicialización y transiciones de una partida en curso. Se prefieren fábricas de datos serializables a instancias de clases con prototipo; la justificación está en DEC-006.

## Invariantes

La lista normativa de invariantes técnicos está en [`invariantes.md`](invariantes.md). Los tests de fronteras vigilan que el motor siga siendo importable en Node y no incorpore APIs del navegador.
