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
                       snapshot v3
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

Es el lugar de las reglas puras y las transiciones de juego. El Bloque 2 implementa consultas de puertos, ramas, destinos y jugadas legales, más `applyPlay(state, action)`: devuelve un snapshot nuevo o un error de dominio sin mutar la entrada. Turnos, pases, puntuación y finalización continúan declarados como no implementados y no devuelven resultados ficticios.

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

El snapshot v3 continúa representando el ciclo único desde reparto hasta salida o tranque. Si se aprueban series o metas acumuladas, un coordinador de match envolverá ese motor de ronda y conservará acumulados sin introducirlos en Board o Rules. La propuesta está en [`modelo-round-match.md`](modelo-round-match.md); no requiere un refactor actual.

## Flujo de una acción de tablero

1. La UI muestra un snapshot recibido.
2. El usuario expresa una intención, por ejemplo jugar una ficha en un puerto lógico.
3. `InteractionController` crea una acción de dominio sin coordenadas.
4. La API pública del motor valida la acción usando `REGLAS.md` y el estado actual.
5. El motor devuelve un nuevo snapshot y un resultado, o un error explícito sin mutar el estado original.
6. La acción aceptada se registra en el historial.
7. La UI vuelve a renderizar; efectos y animaciones observan la transición, pero no la deciden.

En el Bloque 2, `applyPlay` termina tras el paso topológico e histórico: no avanza turno ni toca pases o marcador. Esa coordinación se añadirá en una capa de transición de turno cuando sea autorizada.

## Pureza y mutabilidad

Se favorecerán funciones puras y actualizaciones inmutables. No es requisito congelar recursivamente cada snapshot, pero sí evitar mutaciones compartidas y comprobar invariantes en los límites. Esta estrategia simplifica tests, historial, sincronización y comparación de estados.

## Capacidades no implementadas

Una capacidad todavía no implementada debe fallar de forma explícita o no estar expuesta. Nunca debe responder “válido”, “0 puntos” o “siguiente jugador” como valor provisional, porque ese valor podría confundirse con comportamiento real.

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
