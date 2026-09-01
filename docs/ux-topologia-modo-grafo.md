# Legibilidad topológica del Modo Grafo

## Estado de esta nota

**Cuatro iteraciones funcionales implementadas; alternativas de ampliación todavía en estudio.**

Esta nota parte de una prueba manual del primer GraphRenderer: la ronda puede jugarse y el grafo permite reconocer fichas y destinos, pero no comunica con suficiente claridad la estructura tradicional de línea principal y ramas. El objetivo no es transformar el Modo Grafo en una mesa de dominó, sino estudiar una segunda capa visual, derivada y opcional, sobre el grafo de valores.

La primera implementación no cambió reglas, motor, snapshot, schema ni fuente de verdad.

## Diagnóstico

El renderer actual responde bien a dos preguntas:

1. ¿Qué fichas ya fueron jugadas?
2. ¿En qué destinos lógicos puede jugarse una ficha seleccionada?

No responde con la misma inmediatez a:

1. ¿Qué fichas forman la línea principal?
2. ¿En qué orden están conectadas?
3. ¿Qué fichas forman cada rama?
4. ¿De qué chancho y de cuál puerto lateral nace cada rama?
5. ¿Qué función topológica cumple cada chancho?

No falta información reglamentaria en el snapshot. La dificultad aparece porque el grafo de valores colapsa todas las apariciones de un número en un único vértice. La proximidad visual entre dos aristas alrededor de un valor no afirma que sus placements sean consecutivos. Cuando el grafo se vuelve denso, la colección de aristas sigue siendo correcta, pero la estructura de colocaciones queda visualmente implícita.

El problema es, por tanto, de **codificación visual y revelado progresivo**, no de reversibilidad del estado.

## Fuentes actuales y suficiencia

El `board` v6 ya permite derivar toda la estructura necesaria:

| Información | Fuente actual |
| --- | --- |
| Pertenencia y orden de línea principal | `board.mainLine.placementIds` |
| Ficha de cada colocación | `board.placements[placementId].dominoId` |
| Adyacencia y puertos exactos | `board.connections` |
| Rol y valor de cada puerto | puertos canónicos de `getPlacementPorts` |
| Chanchos especiales, en orden de adquisición | `board.specialDoublePlacementIds` |
| Raíz, puerto, recorrido y terminal de una rama ocupada | ramas derivadas desde `connections` y `branch:1|2` |
| Puertos laterales todavía disponibles | uso de puertos y `getOpenEndTargets` |
| Cronología, actor y equipo | `history` y proyección de grafo de valores |

Las proyecciones existentes son suficientes para fichas, cronología, extremos, legalidad y S, pero no para comunicar toda la topología:

- `getValueGraphProjection` no clasifica una arista como principal o lateral ni indica su posición topológica;
- `projectGraphView` conserva esa forma deliberadamente mínima;
- los targets laterales sí incluyen `branchOrigin`, pero eso solo explica el destino abierto, no la pertenencia de todas las fichas ya colocadas;
- GraphRenderer no debe recorrer `board` directamente para suplir esa carencia.

Si se autoriza una implementación futura, la pieza arquitectónica adecuada sería una **proyección topológica pura y descartable**. No se justifica persistir metadata ni elevar schema.

## Taxonomía que la UI debe respetar

Hay dos ejes independientes:

1. **Región:** línea principal o rama.
2. **Capacidad del chancho:** especial u ordinaria.

Esto produce al menos tres casos relevantes de chancho:

- chancho especial de la línea principal;
- chancho ordinario de la línea principal porque ya se alcanzó el límite K;
- chancho ordinario dentro de una rama, que nunca consume un cupo K.

Por ello, no debe usarse “estilo de rama” como sinónimo de “chancho ordinario”, ni “estilo principal” como sinónimo de “chancho especial”.

## Información necesaria durante la partida

Conviene mantener siempre visible, aunque con baja intensidad:

- qué aristas/lazos pertenecen a la línea principal y cuáles a ramas;
- qué chanchos son especiales;
- qué destinos están legalmente disponibles, como ya ocurre;
- un resumen inequívoco `especiales habilitados / effectiveK`;
- cuando existen ramas, una señal de qué chancho actúa como raíz.

Esta información afecta la comprensión estratégica inmediata: permite anticipar qué estructura puede extenderse, si un nuevo chancho principal adquirirá capacidad especial y qué continuaciones pertenecen a componentes laterales.

## Información útil bajo demanda

No necesita competir permanentemente con el grafo:

- índice exacto de una ficha en la línea principal;
- predecesor y sucesor;
- profundidad dentro de una rama;
- `branch:1` frente a `branch:2`;
- `placementId`, `connectionId` y puertos concretos;
- turno, secuencia, jugador y equipo que colocaron la ficha;
- recorrido completo de una línea o rama;
- coordenadas topológicas propuestas.

Estos datos son valiosos al inspeccionar, aprender o auditar, pero mostrarlos todos a la vez degradaría la lectura de una ronda densa.

## Alternativa A — Estilo topológico permanente

Usar un lenguaje visual discreto y redundante para clasificar cada ficha:

- línea principal: trazo dominante;
- ramas: trazo secundario distinguible por grosor, contorno o patrón, no solo por color;
- chancho especial: halo, corona o insignia breve sobre su lazo;
- chancho ordinario: ausencia del distintivo especial, conservando además el estilo de su región;
- raíz de rama: pequeño marcador de anclaje asociado al lazo especial.

### Ventajas

- La clasificación principal/rama se reconoce sin interacción.
- El estado especial de los chanchos permanece disponible durante la decisión.
- Requiere poco espacio adicional si la gramática visual es sobria.
- Funciona con mouse, tacto y teclado sin depender de abrir un panel.

### Desventajas

- No comunica por sí sola el orden de las fichas.
- La relación exacta entre una rama y su raíz puede seguir siendo ambigua si varias ramas contienen valores similares.
- Patrones demasiado parecidos a las curvas de destinos podrían confundir ficha jugada con lugar jugable.
- Necesita redundancia textual o simbólica para no depender exclusivamente del color.

### En un grafo denso

Conserva razonablemente bien la pertenencia general, pero no resuelve el recorrido. Deben limitarse los estilos simultáneos: por ejemplo, evitar combinar color, guiones, brillo, flechas e índices permanentes sobre todas las aristas.

## Alternativa B — Inspección topológica por selección

Al seleccionar o enfocar una arista/lazo:

- atenuar temporalmente las fichas no relacionadas;
- resaltar la línea principal completa o la rama a la que pertenece;
- si pertenece a una rama, resaltar también el chancho raíz;
- mostrar orden local, predecesor, sucesor, raíz y profundidad;
- permitir recorrer con “anterior/siguiente” la secuencia topológica.

La selección no ejecuta una jugada: es estado efímero de inspección y debe coexistir claramente con la selección de una ficha de la mano.

### Ventajas

- Hace visible el recorrido sin mantener todo el grafo etiquetado.
- Escala bien cuando hay muchas aristas: el foco reduce el ruido.
- Permite explicar una rama y su raíz de forma muy directa.
- Puede reutilizar foco de teclado y nombres accesibles.

### Desventajas

- La estructura no se descubre de inmediato si el usuario no conoce la interacción.
- Hay que distinguir “inspeccionar ficha jugada” de “seleccionar ficha de la mano”.
- Un recorrido superpuesto sobre el heptágono puede cruzarse consigo mismo; el orden debe apoyarse también en etiquetas o un resumen textual.
- En táctil necesita un cierre claro del modo de inspección.

### En un grafo denso

Es la alternativa más robusta dentro del lienzo. La atenuación permite seguir una sola estructura. No conviene dibujar permanentemente una polilínea que una centros de aristas en orden: en estados densos produciría una segunda maraña visual.

## Alternativa C — Panel auxiliar de estructura

Añadir un panel o cajón derivado, enlazado bidireccionalmente con el grafo:

```text
Línea principal
[6|6] — [6|4] — [4|1] — ...

Ramas de [5|5]
branch:1  [5|2] — [2|3]
branch:2  [5|0]
```

Cada ficha del panel sería seleccionable para enfocar su arista/lazo en el grafo. No sería un segundo tablero reglamentario ni una imitación espacial de la mesa: sería una vista estructural compacta y derivada.

### Ventajas

- Es la representación más inequívoca del orden completo.
- Explica naturalmente raíz, rama y profundidad.
- Puede mostrar texto accesible y detalles sin recargar el SVG.
- Se mantiene legible aunque el grafo de valores sea casi completo.

### Desventajas

- Divide la atención entre grafo y panel.
- Puede parecer una segunda vista si no se presenta como inspector.
- En teléfono debe convertirse en cajón, hoja inferior o diálogo para no reducir demasiado el grafo.
- Una línea larga exige desplazamiento, plegado o segmentación.

### En un grafo denso

Escala mejor que las etiquetas permanentes. El panel puede plegar ramas y mantener visible solo la secuencia seleccionada. El enlace visual con el grafo debe ser inmediato para evitar que ambas zonas parezcan independientes.

## Alternativa D — Modo opcional “Ver estructura”

Un control explícito activa una capa temporal con etiquetas topológicas:

- posiciones de línea principal;
- identificadores de rama y profundidad;
- insignias de raíz y estado especial;
- posible resaltado secuencial.

La propuesta documentada `-p,…,-1,1,…,q` o un offset firmado con ancla en cero podría usarse aquí, pero no debe adoptarse antes de probar comprensión. Una alternativa más directa para usuario es una etiqueta ordinal derivada, como `M1…Mn`, y ramas `M4·B1·1`, `M4·B1·2`.

### Ventajas

- El grafo permanece limpio por defecto.
- Permite estudiar coordenadas sin convertirlas en estado persistido.
- Resulta útil para aprendizaje, auditoría y capturas explicativas.

### Desventajas

- Una pantalla llena de códigos puede ser más técnica que intuitiva.
- Los índices ordinales cambian cuando la línea se extiende por el inicio.
- Los offsets estables requieren ancla y dirección explícitas.
- Las etiquetas de todas las fichas compiten con números, lazos y targets.

### En un grafo denso

Debe combinarse con atenuación o filtrado. Mostrar simultáneamente todos los códigos no es recomendable en teléfono ni en una ronda casi terminada.

## Comparación resumida

| Alternativa | Lectura inmediata | Orden completo | Grafo denso | Coste cognitivo |
| --- | --- | --- | --- | --- |
| A. Estilo permanente | Alto para región/estado | Bajo | Medio | Bajo |
| B. Inspección por selección | Medio | Alto para la estructura enfocada | Alto | Medio |
| C. Panel auxiliar | Medio | Muy alto | Muy alto | Medio |
| D. Modo con etiquetas | Bajo hasta descubrirlo | Alto | Bajo sin filtrado | Alto |

Ninguna alternativa satisface por sí sola todos los objetivos.

## Tratamiento de K

K necesita una presentación semánticamente precisa:

- `K` es el límite reglamentario configurado;
- `effectiveK = min(K, 7)` es la capacidad efectiva del doble-seis;
- `specialDoublePlacementIds.length` es la cantidad de chanchos principales que ya adquirieron capacidad especial y, por tanto, los cupos consumidos;
- una rama iniciada no consume otro cupo;
- un chancho dentro de una rama nunca consume cupo;
- cantidad de chanchos especiales, cantidad de ramas iniciadas y cantidad de puertos usados son métricas diferentes.

Una etiqueta como `Especiales: 3/7` es más clara que `K usado: 3`, acompañada, al inspeccionar un chancho, por:

```text
Especial de línea principal
Conexiones: 3/4
Ramas iniciadas: 1/2
```

Para un chancho ordinario debe indicarse la causa topológica cuando resulte útil:

```text
Ordinario · pertenece a una rama
```

o:

```text
Ordinario · línea principal · cupos especiales agotados
```

Si en el futuro la UI admite un K mayor que 7, debería distinguir K configurado de capacidad efectiva en lugar de mostrar una fracción imposible.

## Recomendación provisional — Solución híbrida progresiva

La combinación más equilibrada es:

1. **Base permanente mínima:** diferenciar línea principal y ramas con dos estilos sobrios; marcar chanchos especiales con un símbolo redundante; mostrar `Especiales: s/effectiveK`.
2. **Inspección contextual:** al seleccionar una ficha jugada, atenuar el resto, resaltar su secuencia completa y, si es lateral, enfatizar el chancho raíz. Mostrar posición local, vecinos y profundidad.
3. **Panel de estructura plegable:** ofrecer el orden completo de línea y ramas para quien necesite reconstruir la mesa lógica, especialmente en grafos densos o pantallas pequeñas.
4. **Etiquetas topológicas opcionales:** mantenerlas fuera de la vista normal y evaluarlas dentro de “Ver estructura”; no decidir todavía entre ordinales, offsets firmados o coordenadas compuestas.

Esta solución preserva el heptágono y la interpretación matemática de aristas/lazos. La topología actúa como segunda capa derivada y no determina legalidad.

## Primera materialización aprobada

Se implementaron los dos primeros niveles de la recomendación y un inspector local mínimo:

- proyección pura por `placementId` con región, orden, raíz, puerto, profundidad y clasificación de chanchos;
- resumen derivado `Especiales: s/effectiveK`;
- trazo continuo para principal y segmentado para rama;
- símbolo gráfico redundante para chanchos especiales;
- selección de una ficha jugada para resaltar toda su estructura, conservar visible la raíz de rama y atenuar el resto;
- detalle de rol, conexiones/capacidad y ramas iniciadas;
- cierre por repetición, botón o `Escape`.

No se implementaron el panel estructural completo, coordenadas permanentes, replay, Modo Tradicional ni acabado premium. La experiencia densa continúa necesitando evaluación humana aunque la suite comprueba que fichas, targets e identidad individual permanecen disponibles.

## Segunda a cuarta iteración de extremos

La segunda iteración hizo que cada `openEndTarget` heredara su región y estructura exactas, reforzó el trazo principal y lateral, extendió la inspección a la colita terminal y sustituyó la letra `E` por un símbolo independiente de color y patrón.

La tercera resolvió dos observaciones adicionales:

1. **La colita comunica qué estructura continúa.** La principal recibe el código `P`. Cada puerto lateral potencial recibe `A`, `B`, `C`… por orden de adquisición del chancho especial y, dentro de él, `branch:1` antes de `branch:2`. La misma letra aparece en el chancho raíz, en todas las fichas de la rama y en el extremo terminal.
2. **Los extremos existen visualmente antes de elegir ficha.** El estado neutral conserva colita gruesa, terminal de diez unidades y código. La selección no revela targets previamente ocultos: eleva los compatibles, añade un índice de opción y atenúa los incompatibles.

La identidad alfabética es metadata descartable de UI. No reemplaza `placementId + portId`, no entra en acciones, no altera legalidad y puede recalcularse íntegramente desde el mismo snapshot. Se eligió un estado neutral estático: animar simultáneamente hasta dieciséis extremos agregaría ruido. Solo los legales usan el pulso discreto ya compatible con `prefers-reduced-motion`.

La cuarta iteración simplifica esa convención después de probarla en PC y teléfono:

1. **Una familia por chancho especial.** El primer chancho especial origina la familia `A`, el segundo `B`, etc. Sus puertos exactos `branch:1` y `branch:2` son brazos independientes del motor, pero ambos se presentan como `A` porque comparten raíz y función visual.
2. **Vista normal sin redundancia.** Una arista entre 2 y 5 ya expresa `2|5`; un lazo en 4 ya expresa `4|4`. Sus rótulos permanentes desaparecen. Las letras tampoco se repiten en cada ficha interior: permanecen en la raíz y en los extremos abiertos.
3. **Extremos como controles protagonistas.** `P`, `A`, `B`… se ven en reposo. Los índices `1`, `2`, `3` solo aparecen si la ficha seleccionada tiene más de un target compatible del mismo valor; identifican la opción concreta, nunca la estructura.
4. **Brazos potenciales frente a iniciados.** Una colita lateral vacía usa curva corta punteada y terminal hueco. El terminal de una cadena lateral ya iniciada usa el patrón común segmentado y relleno suave. Ambos conservan el mismo código de familia.
5. **Inspección por familia.** Activar una arista lateral, una colita o el badge del chancho resalta los dos brazos existentes, la raíz y sus extremos, y atenúa las demás estructuras. El resumen usa “Ramificación A” y “Nace del chancho 5|5”, sin IDs técnicos.

El acento cromático rota en una paleta sobria, pero se combina siempre con línea continua/segmentada, letra y relleno potencial/iniciado. El color nunca es la única codificación. No se muestra `×q` en la vista normal porque las curvas individuales y sus códigos ya comunican la multiplicidad sin otro rótulo.

## Proyección topológica materializada

La proyección pura proporciona por placement:

- `region: "main" | "branch"`;
- posición ordinal en `main`;
- `originPlacementId`, `originPortId` y `depth` en ramas;
- `isSpecialDouble`;
- cantidad de conexiones y puertos libres;
- datos cronológicos ya derivados por separado.

También produce un resumen:

- `configuredK`;
- `effectiveK`;
- `enabledSpecialDoubleCount`;
- ramas ocupadas agrupadas por raíz y puerto.

Todos estos valores se derivan del snapshot actual. La identidad estable continúa siendo `placementId` y `portId`; ninguna coordenada visual o etiqueta topológica debe persistirse.

La agrupación familiar agrega únicamente metadata descartable: `familyId`, código, índice, raíz y dos brazos con su puerto exacto y estado ocupado. Un chancho ordinario en rama o en principal por K agotado conserva su clasificación, pero no origina familia.

## Criterios para una evaluación futura

Antes del refinamiento premium deberían compararse las alternativas con:

- línea principal larga sin ramas;
- varios chanchos principales, especiales y ordinarios;
- dos ramas del mismo chancho;
- ramas de varios chanchos;
- chancho ordinario dentro de una rama;
- K parcialmente consumido y K agotado;
- grafo casi completo;
- teléfono, tablet, escritorio, teclado y lector de pantalla;
- ausencia de confusión entre curva jugable, ficha de rama y término de S.

La métrica principal no es fidelidad a una mesa dibujada, sino si el jugador puede responder con rapidez y sin ensayo:

> ¿Dónde está esta ficha dentro de la estructura lógica y qué papel cumple este chancho?
