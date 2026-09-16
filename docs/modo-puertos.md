# Vista experimental Puertos

> **Nota de vigencia (DEC-050):** las mediciones y recomendaciones K de este documento son registro histórico de los prototipos v1–v3. El producto vigente solo ofrece **Ramificado** —un único chancho ramificador— y **Lineal**. La proyección de incidencias permanece válida.

## Propósito

Puertos es una representación intermedia entre la mesa topológica completa y el grafo simple de valores. Mantiene exactamente siete macro-nodos y conserva qué incidencias continúan entre sí. Es una proyección descartable para UI: no es fuente de verdad, no valida jugadas y no añade campos al snapshot v6.

```text
board lógico
    │
    ▼
PortGraphProjection
    │
    ▼
PortScene (jerarquía y geometría descartables)
    │
    ▼
PortRenderer (SVG e intención del usuario)
```

La tercera iteración mantiene íntegro ese modelo y separa explícitamente juego y análisis. En un turno normal no serializa los 42 puertos potenciales ni la estructura completa: una tapa central deja protagonismo a los siete valores, los extremos reales y la decisión inmediata. Hilos, puentes, hubs e incidencias siguen completos en la escena y reaparecen bajo demanda.

## Definición implementada

Para cada `n ∈ {0,…,6}` existe un único macro-nodo `B_n`. Contiene los seis puertos ordinarios:

```text
p(n→m), con m ∈ {0,…,6} y m ≠ n
```

El ID derivado es estable y no depende del turno. Una ficha no doble `[n|m]` colocada se proyecta como un hilo exterior que une `p(n→m)` con `p(m→n)`. La ficha conserva `dominoId`, `placementId`, región y metadata temporal derivada.

Una conexión del board que continúa por el valor `n` se proyecta dentro de `B_n` como puente entre sus dos endpoints reales. Un endpoint puede ser un puerto ordinario o un socket de doble. Dos pasos diferentes por el mismo `B_n` conservan `connectionId` y parejas diferentes, por lo que no se mezclan.

## Dobles

El doble `[n|n]` es un hub interno asociado a `B_n`; nunca crea otro nodo ni ocupa un puerto `p(n→m)`.

- ordinario: dos sockets derivados de `side:a` y `side:b`;
- especial de línea principal: cuatro sockets derivados de `main:1`, `main:2`, `branch:1` y `branch:2`.

Los nombres internos solo mantienen identidad para el motor y la acción. La UI describe esos sockets como extremos principales, laterales u ordinarios y no filtra IDs técnicos.

## Extremos e interacción

Los 42 puertos ordinarios potenciales se dibujan discretamente, pero solo una incidencia de ficha ya colocada incluida en `getOpenEndTargets` se convierte en extremo vivo. Los targets conservan `placementId + portId`; varios extremos del mismo valor siguen siendo controles separados y reciben números únicamente cuando una selección necesita desambiguarlos.

Sin ficha seleccionada, los extremos reales son ojales con halo y área táctil, mientras los puertos potenciales casi desaparecen. Con selección, los compatibles ganan énfasis y los incompatibles se atenúan. Varios targets del mismo valor continúan siendo controles separados; si quedan demasiado próximos, abrir el macro-nodo separa sus incidencias sin cambiar el target canónico. `START`, `PASS`, cierre, privacidad local y feedback posterior se comparten con las otras vistas mediante `InteractionController` y `projectRoundView`.

Puertos no calcula S desde incidencias ni extremos. El feedback utiliza `scoringPresentation`, basado en `scoringTerms`, de modo que un doble con socket libre y contribución cero se representa correctamente.

## Línea principal y ramas

Principal y ramas se clasifican desde la topología existente. La principal usa hilo continuo; las ramas, trazo segmentado y un acento sobrio de familia. Inspeccionar un extremo, hilo, puerto o puente resalta el brazo exacto —o la principal completa— junto con sus puentes, raíz y extremos, y atenúa agresivamente lo ajeno. La inspección de familia de las otras vistas sigue disponible, pero Puertos permite un foco más preciso por brazo. Una rama que vuelve a visitar un valor ya usado por la principal reutiliza el mismo `B_n`, pero con otra pareja de incidencias.

La densidad interior se resuelve bajo demanda mediante «abrir el saco»: una lente SVG amplía el valor elegido, separa en posiciones estables sus seis incidencias `p(n→m)`, muestra puentes y sockets del hub, y conserva los targets exactos. Un resumen textual secundario deja las parejas completas bajo un detalle desplegable. Es accesible por tacto, mouse, teclado y `Escape`.

## Gramática visual v2

La escena tiene tres estados explícitos:

- **reposo:** medallones y extremos dominan; solo los hilos que terminan en un extremo vivo conservan contraste alto; hilos cerrados, puentes y puertos potenciales son contexto;
- **decisión:** al seleccionar una ficha, los targets compatibles y sus incidencias propietarias pasan al primer plano; el resto se atenúa y no se anticipan S ni puntos;
- **inspección:** un recorrido exacto se enfatiza de extremo a extremo y todas las estructuras ajenas pierden casi todo su contraste.

Los hilos ya no son cuerdas rectas que cruzan el centro. Cada ficha usa una curva Bézier determinista sobre un carril anular: la principal ocupa el carril interior continuo y las ramas un carril algo más exterior y segmentado. No es *edge bundling* semántico: cada hilo conserva su path, endpoints, `placementId` y control independiente.

Los macro-nodos usan capas de medallón, aro e interior para admitir posteriormente una materialidad más rica sin cambiar la escena. Los dobles se integran como mecanismos: dos brazos en un ordinario y cuatro en un especial, con los brazos laterales segmentados. No aparecen rótulos técnicos ni se duplica el valor.

## Gramática game-first v3

La tapa central es una capa descartable del renderer, no parte de `PortGraphProjection`. Organiza cuatro niveles de revelado:

- **Jugar:** es el estado inicial. Permanecen los siete medallones y una cola corta por cada `openEndTarget` real. Los hilos y puentes completos no se incluyen en el SVG; tampoco se dibujan los 42 puertos potenciales.
- **Decidir:** seleccionar una ficha conserva la tapa, resalta solo sus targets legales exactos y numera únicamente opciones que necesitan desambiguación. No anticipa S ni puntos.
- **Seguir recorrido:** tocar un extremo, hilo local o incidencia dibuja por encima de la tapa únicamente los hilos y puentes del recorrido pertinente. El resto no queda como maraña atenuada: se omite.
- **Ver estructura:** una acción central restaura la representación completa de v2, con todos los hilos, puentes, incidencias utilizadas, hubs y ramas. La misma acción devuelve a Jugar.

Cada cola nace en la incidencia propietaria y termina en un ojal táctil separado. Principal conserva trazo continuo y rama, segmentado; dos extremos del mismo valor siguen siendo dos controles distintos con su propio `placementId + portId`. Los puertos potenciales solo aparecen en Ver estructura o al abrir el saco.

«Abrir el saco» sigue siendo el detalle local del valor, pero evita notación `p(n→m)`: las seis posiciones estables se rotulan solo con el otro valor. Usado, abierto y potencial se distinguen por estado visual; el hub de doble queda integrado. Hay una única acción visible de cierre, más `Escape` por teclado.

Durante el feedback posterior a `PLAY_DOMINO`, la tapa funciona como superficie de explicación: recibe de `scoringPresentation` la expresión, S, divisor y resultado. No reconstruye términos desde colas y no duplica el panel general. Al concluir la secuencia efímera vuelve a su contenido de juego; con `enabled: false` no mostraría ninguna explicación de divisibilidad.

### Comparación v2/v3

V3 gana calma visual, targets reconocibles y un flujo de decisión utilizable sin estudiar el diagrama completo. Pierde en reposo la panorámica ambiental de por dónde discurren todos los recorridos. Esa pérdida es deliberada y reversible: Seguir recorrido recupera una estructura aislada y Ver estructura recupera v2 íntegro. La tapa resultó útil siempre que las colas abiertas no se ocultaran con ella; por eso los extremos quedan fuera y por encima de su borde.

## Diagnóstico cuantitativo y K

La medición previa al rediseño separó el problema basal de la amplificación causada por K. En posiciones completas sin prioridad visual había 21 hilos no dobles y hasta 35 cruces rectos incluso con `K=0`; por tanto, las ramas no eran la causa única. Los 42 puertos potenciales, puentes, hubs y targets elevaban una posición completa a alrededor de 120–136 marcas simultáneas.

Un fixture sintético de estrés —siete dobles en principal y ambos brazos disponibles para los primeros K especiales— produjo:

| K | hilos | cruces rectos v1 | brazos activos | extremos | marcas simultáneas v1 |
|---:|---:|---:|---:|---:|---:|
| 0 | 6 | 0 | 0 | 2 | 90 |
| 1 | 8 | 0 | 2 | 4 | 98 |
| 2 | 10 | 3 | 4 | 6 | 106 |
| 3 | 12 | 8 | 6 | 8 | 114 |
| 5 | 16 | 18 | 10 | 12 | 130 |
| 7 | 20 | 35 | 14 | 16 | 146 |

La geometría v2 y el revelado progresivo atacan cruces perceptivos e información simultánea; no cambian ninguna cifra reglamentaria. Como recomendación de experiencia, `K=2` o `K=3` ofrece ramificación estratégica sin llevar de forma habitual a 10–14 brazos potenciales. `K=0…7` continúa completamente soportado, la UI no impone una cota y su valor predeterminado no cambia en este bloque. K altos deben considerarse una configuración avanzada hasta acumular más pruebas humanas.

## Fixture de continuidad

El fixture sin dobles:

```text
6–1–4–0–2–5–3–1–2–4–6–0–5
```

produce doce hilos y once puentes. En `B_1`, por ejemplo, los pasos `6–1–4` y `3–1–2` generan parejas interiores distintas. Recorrer hilo → puente → hilo recupera toda la secuencia sin crear copias de 1, 2, 4 o cualquier otro valor.

## Responsive y limitación observada

Las geometrías compacta y ancha conservan un heptágono reconocible, carriles anulares y ausencia de overflow horizontal global. En 1366×768 los medallones, ojales, hubs y recorridos inspeccionados se leen con claridad; el centro deja de ser la zona dominante.

En 390×844 los siete nodos conservan aproximadamente 48 px de caja visual en un estado denso y no existe overflow horizontal de página. Los ojales exactos próximos a un hub especial no siempre son cómodos como selección global: «abrir el saco» es la interacción recomendada para separarlos. Un recorrido inspeccionado se puede seguir, pero una posición `K=5/7` casi completa no se entiende globalmente de una sola mirada. Esta limitación sigue siendo honesta: Puertos v2 es jugable en teléfono para decisiones locales, no una vista panorámica exhaustiva de todos los recorridos simultáneos.

Con la interfaz game-first, en 390×844 el comienzo del tablero pasó aproximadamente de `y=310` a `y=131`, una reducción de 179 px (58 %) en información previa; el comienzo de la mano pasó de `y=726` a `y=506`. Cabecera, turno/marcador/S y selector caben antes del tablero sin overflow horizontal. La vista normal hace cómoda la decisión local tanto en Ramificado como en Lineal; la estructura exhaustiva continúa siendo deliberadamente una consulta bajo demanda.

## Presentación estratégica vigente

La iteración posterior a DEC-050 conserva intacto el grafo de incidencias, pero cambia el primer nivel de lectura. Los siete `B_n` se presentan como medallones estables que muestran el valor y cuántos targets reglamentarios siguen abiertos. El conteo de fichas distintas `n/7` continúa derivado —un doble cuenta una ficha, no dos apariciones—, pero aparece solo al inspeccionar el medallón. Los badges de targets nunca representan términos de S.

Al seleccionar una ficha, solo los valores compatibles adquieren halo y grosor adicional. Un valor con un único target despacha directamente ese target; con varios se abre un selector humano `Destino 1…q`, cuya asociación exacta a `placementId + portId` permanece en memoria y no se imprime en HTML. No se muestran S futuro, divisibilidad ni puntos anticipados.

En Ramificado, el medallón que contiene el único chancho ramificador integra cuatro indicadores compactos de ocupación y conserva su identidad al saturarse. En Lineal no aparece ese mecanismo. La geometría tenue de `K₇` es únicamente fondo matemático y no expresa fichas jugadas ni legalidad. **Ver estructura** recupera hilos, puentes, hubs e incidencias para análisis; la vista normal no los serializa.

### Separación entre acción y puntuación

La vista normal responde a dos consultas distintas sin fusionarlas:

- **teal exterior:** el valor posee uno o más targets exactos compatibles con la ficha seleccionada; el badge conserva la multiplicidad reglamentaria;
- **dorado interior:** al menos un `scoringTerm` contribuyente posee ese valor y forma parte de S ahora.

Ambas señales pueden coexistir. El ejemplo decisivo es un ramificador que todavía ofrece sockets: después de su segunda conexión puede conservar dos targets y, sin embargo, deja de aportar `2N`. El medallón mantiene badge/estado estructural neutro o teal, pero pierde su anillo dorado. El renderer nunca deriva ese resultado de sockets: consume `scoringPresentation` y filtra únicamente términos con contribución positiva para el rótulo «SUMAN AHORA».

El centro muestra chips agrupados (`2×N` para el doble cuando corresponde), la expresión y `S`. La resolución «múltiplo/no múltiplo» y los puntos aparecen solo durante el feedback posterior a una acción aceptada. Si el contrato futuro declara `enabled: false`, el centro matemático desaparece sin tocar targets ni topología.

El ramificador usa una marca neutral de cuatro ocupaciones y `n/7` queda en un inspector estratégico junto con targets abiertos y, si aplica, ocupación `c/4`. El dorado queda reservado por contrato visual a scoring; la estructura analítica emplea neutros y teal.

## Comparación

- frente a Tradicional, Puertos conserva mejor las visitas repetidas a un valor y los mecanismos de dobles, pero exige aprender hilo ↔ puente y usar foco en densidad alta;
- frente a Grafo, aporta información distintiva suficiente: identifica qué entrada continúa con qué salida y representa dobles como hubs explícitos; a cambio es visualmente más complejo;
- Tradicional sigue siendo la vista físicamente más inmediata; Puertos ofrece la lectura estratégica más compacta de valores disponibles, multiplicidad de targets y composición actual de S, con agotamiento `n/7` bajo demanda; Grafo conserva la lectura matemática más simple de valores/aristas. El reglamento vigente solo expone Ramificado y Lineal; las comparaciones K anteriores permanecen exclusivamente como registro histórico del prototipo.

Una visualización postpartida por pisos o carriles de ramas queda registrada como posibilidad futura. No forma parte de v3 ni se persiste en el snapshot.
