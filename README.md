# Dominó múltiplo de 5

Base arquitectónica para un juego web de **Dominó múltiplo de 5**, inicialmente pensado para una modalidad local de 2 contra 2 y preparado para evolucionar, sin acoplar el motor a la interfaz, hacia persistencia y multijugador remoto.

## Estado actual

La **Fase 0 — Especificación y arquitectura** está completada. La **Fase 1 está en curso y sus bloques 1 y 2 están completados**: el motor inicializa el snapshot v3 y ya puede enumerar y aplicar colocaciones sobre la línea principal y sus ramas. **Todavía no implementa el flujo de turnos, puntuación, pases, tranque ni finalización.**

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
- [`docs/variantes-futuras.md`](docs/variantes-futuras.md)
- [`docs/modelo-round-match.md`](docs/modelo-round-match.md)

Estos cuatro documentos no son normativos y no sustituyen `REGLAS.md`.

## Requisitos

- Un navegador moderno con soporte para módulos ES.
- Node.js 20 o posterior para los comandos de desarrollo y tests. El proyecto no instala dependencias de npm.

## Ejecución local

```bash
npm start
```

Abrir `http://localhost:4173`. No conviene abrir `index.html` directamente con `file://`, porque los navegadores restringen la carga de módulos ES en ese contexto.

También puede usarse cualquier servidor HTTP estático equivalente.

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
- `applyPlay(state, action)` para una transición topológica inmutable;
- `getDerivedBranches(state)` y `validateBoardState(state)` para consulta y validación del tablero ocupado.

`applyPlay` es deliberadamente una operación de bajo nivel en este bloque: registra la colocación, pero no avanza el turno ni calcula puntuación.

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
