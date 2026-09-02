# Dominó múltiplo de 5

Base arquitectónica para un juego web de **Dominó múltiplo de 5**, inicialmente pensado para una modalidad local de 2 contra 2 y preparado para evolucionar, sin acoplar el motor a la interfaz, hacia persistencia y multijugador remoto.

## Estado actual

Las **Fases 0 y 1 están completadas**. El motor inicializa el snapshot v6 y permite jugar una ronda 2 contra 2 completa: tablero lógico, turnos, pases, tranque, S, puntos por múltiplos de 5, vencedor tradicional, bonificación y resultado final por puntaje. La **Fase 2 está en curso** y dispone de dos vistas jugables sobre el mismo estado: TraditionalRenderer como entrada principal y GraphRenderer SVG como vista analítica disponible mediante el conmutador. La mesa orienta fichas desde puertos reales, mantiene conectores y targets fuera de sus interiores y ofrece una cámara ajustable/desplazable. La interfaz explica después de cada jugada la secuencia términos → S → divisibilidad → puntos y protege la mano siguiente con una barrera local. Una pantalla inicial permite elegir `K=0…7` y la vista de arranque; tras el cierre puede iniciarse otra partida independiente sin conservar score ni historial. Múltiples rondas, metas acumuladas, divisor configurable y refinamiento premium continúan fuera de alcance.

## Documentos de autoridad

> `REGLAS.md` define las reglas del juego.  
> `PLAN_MAESTRO.md` define la hoja de ruta.  
> Los archivos dentro de `docs/` documentan arquitectura y decisiones técnicas.

Si el código contradice `REGLAS.md`, la contradicción debe señalarse y resolverse explícitamente; el código no modifica las reglas por sí solo.

Antes de cambiar el motor, leer en este orden:

1. [`REGLAS.md`](REGLAS.md)
2. [`PLAN_MAESTRO.md`](PLAN_MAESTRO.md)
3. [`docs/arquitectura.md`](docs/arquitectura.md)
4. [`docs/modelo-tablero.md`](docs/modelo-tablero.md)
5. [`docs/modelo-estado.md`](docs/modelo-estado.md)
6. [`docs/invariantes.md`](docs/invariantes.md)
7. [`docs/decisiones-diseno.md`](docs/decisiones-diseno.md)

Para diseño futuro de producto y renderers:

- [`docs/modos-visualizacion.md`](docs/modos-visualizacion.md)
- [`docs/modo-grafo.md`](docs/modo-grafo.md)
- [`docs/reversibilidad-grafo-tradicional.md`](docs/reversibilidad-grafo-tradicional.md)
- [`docs/ux-topologia-modo-grafo.md`](docs/ux-topologia-modo-grafo.md)
- [`docs/variantes-futuras.md`](docs/variantes-futuras.md)
- [`docs/modelo-round-match.md`](docs/modelo-round-match.md)

Estos seis documentos no son normativos y no sustituyen `REGLAS.md`.

## Requisitos

- Un navegador moderno con soporte para módulos ES.
- Node.js 20 o posterior para los comandos de desarrollo y tests. El proyecto no instala dependencias de npm.

## Ejecución local

```bash
npm start
```

Abrir `http://localhost:4173`. No conviene abrir `index.html` directamente con `file://`, porque los navegadores restringen la carga de módulos ES en ese contexto.

También puede usarse cualquier servidor HTTP estático equivalente.

Al abrir la aplicación todavía no se ha repartido. Elija cuántos chanchos especiales admite la partida (`K`, de 0 a 7), seleccione la vista inicial y pulse **Jugar**. El conmutador permite cambiar de vista durante la misma partida. Al terminar, **Jugar otra** mezcla y reparte desde cero conservando K y la vista actual; **Cambiar configuración** vuelve a la pantalla inicial. Estas partidas son independientes, no rondas acumuladas de un match.

## Tests

```bash
npm test
```

Los tests se ejecutan con `node:test`, sin navegador ni paquetes externos. La cobertura actual y el backlog de bloques posteriores están en [`tests/README.md`](tests/README.md).

## API pública actual del motor

La fachada `src/js/game/index.js` expone:

- `createMatch` y `validateInitialMatchSnapshot` para inicialización;
- `getOpenEndTargets(state)` para destinos abiertos individualizados;
- `getLegalPlays(state, playerId)` para combinaciones completas de ficha y destino;
- `getAvailableActions(state)` para las acciones reglamentarias del jugador actual;
- `applyTurnAction(state, action)` para jugar o pasar con turno, historial y cierre completo de ronda;
- `getScoringTerms(state)` y `calculateOpenEndsSum(state)` para explicar y sumar S;
- `calculateMoveScore(openEndsSum)` para la política vigente de múltiplos de 5;
- `calculateRemainingPipsByTeam(state)` y `calculateFinalBonus(a)` para explicar el cierre;
- `getValueGraphProjection`, `getBoardTopologyProjection`, `getTraditionalBoardProjection`, agrupaciones de extremos y proyecciones de legalidad/S para preparar vistas;
- `getStrategicTargetProjections` para anticipar puramente el resultado exacto de cada destino legal; la experiencia estándar no muestra su puntuación antes de jugar;
- `projectRoundView`, `projectGraphView` y `projectTraditionalView` como fachadas puras compartidas o específicas de renderer;
- `validateRoundState(state)` para snapshots reglamentarios activos o terminados;
- `applyPlay(state, action)` para una transición topológica inmutable de bajo nivel;
- `getDerivedBranches(state)` y `validateBoardState(state)` para consulta y validación del tablero ocupado.

La UI usa `getAvailableActions` y `applyTurnAction` a través de un único `InteractionController` por partida. `LocalGameSessionController` crea o reemplaza ese controlador mediante `createMatch`; no acumula resultados ni agrega campos al snapshot. El conmutador solo elige qué renderer consume las proyecciones y no recibe el snapshot. `applyPlay` permanece pública para tests del tablero y consumidores técnicos compatibles, pero no impone el turno, no acredita puntos ni representa una acción reglamentaria completa.

## Estructura general

```text
.
├── index.html                 # Entrada publicable en GitHub Pages
├── src/
│   ├── css/                   # Estilos, sin lógica de juego
│   ├── js/
│   │   ├── game/              # Modelo y límites del motor, sin DOM
│   │   ├── ui/                # Renderizado e interacciones
│   │   └── utils/             # Utilidades transversales sin reglas
│   └── assets/                # Recursos estáticos futuros
├── tests/                     # Tests ejecutables sin navegador
├── scripts/                   # Herramientas locales sin dependencias
├── docs/                      # Arquitectura y decisiones
└── prototypes/                # Experimentos no normativos
```

`index.html` está en la raíz, en lugar de `src/`, para que GitHub Pages pueda servir el proyecto directamente sin paso de compilación. La decisión completa está en `docs/arquitectura.md`.

## Publicación en GitHub Pages

Al ser un sitio estático sin build, puede publicarse configurando Pages para desplegar desde la raíz de la rama elegida. Todos los enlaces del sitio son relativos y admiten una URL bajo un subdirectorio de repositorio.

## Dependencias

- Dependencias de ejecución: ninguna.
- Dependencias de desarrollo: ninguna externa.
- Herramientas: Node.js y sus módulos estándar.

Toda dependencia futura debe justificarse en `docs/decisiones-diseno.md` antes de incorporarse.
