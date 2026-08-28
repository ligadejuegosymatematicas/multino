# Modelo lógico del tablero

## Objetivo

El tablero es un grafo lógico de colocaciones, puertos y conexiones. Su topología está definida por R-031 a R-035. No contiene coordenadas, rotaciones ni direcciones de pantalla.

## Esquema normativo

```js
{
  placements: {
    "placement-17": {
      id: "placement-17",
      dominoId: "5-5"
    }
  },
  connections: {
    "connection-9": {
      id: "connection-9",
      from: { placementId: "placement-4", portId: "side:b" },
      to: { placementId: "placement-17", portId: "main:1" }
    }
  },
  mainLine: {
    placementIds: ["placement-1", "placement-4", "placement-17"]
  },
  specialDoublePlacementIds: ["placement-17"]
}
```

El Bloque 2 fijó esta forma de tablero dentro de schema v3. El schema v4 del Bloque 3 conserva el tablero sin `branches`, orientación ni contadores de IDs.

## Contrato ejecutable de acciones

La primera ficha no tiene conexión previa:

```js
{
  type: "PLAY_DOMINO",
  playerId: "P1",
  dominoId: "2-5",
  target: { kind: "START" }
}
```

Toda ficha posterior señala un puerto abierto individual:

```js
{
  type: "PLAY_DOMINO",
  playerId: "P3",
  dominoId: "3-5",
  target: {
    kind: "OPEN_END",
    placementId: "placement-1",
    portId: "side:b"
  }
}
```

Un `target` que contenga solamente `value: 5` es inválido. El valor permite comprobar compatibilidad; no identifica el destino.

## Fichas, colocaciones y conexiones

La ficha física pertenece al catálogo de la partida. Una colocación referencia esa ficha una sola vez. Una conexión es una arista que une exactamente dos puertos lógicos de colocaciones distintas.

R-028 exige igualdad de valores en toda conexión. Una arista aceptada debe permitir resolver el valor de ambos puertos y comprobar que son iguales.

La colocación no persiste `region`, `role`, secuencia histórica ni orientación gráfica.

## Línea principal ordenada

`mainLine.placementIds` es una secuencia normativa, no un conjunto desordenado. Representa el recorrido lógico del camino principal desde uno de sus extremos hasta el otro.

Invariantes de interpretación:

- la primera ficha ocupa la única posición inicial;
- cada par consecutivo del array está unido por una conexión de continuidad principal;
- ninguna colocación aparece dos veces;
- agregar en el primer extremo hace `prepend` conceptual;
- agregar en el segundo extremo hace `append` conceptual;
- el primer y último elemento permiten derivar los dos extremos principales actuales;
- con una sola ficha, los dos extremos pertenecen a esa misma colocación.

No se asigna significado visual al extremo inicial o final del array. El renderer puede invertir o curvar la presentación sin cambiar el estado.

## Cómo clasificar una nueva colocación

Una acción aceptada se clasifica de forma inequívoca por su puerto objetivo:

1. **Extensión principal:** el objetivo es uno de los dos extremos principales actuales. La nueva colocación se agrega al inicio o final de `mainLine.placementIds`.
2. **Inicio de ramificación:** el objetivo es `branch:1` o `branch:2` de una colocación incluida en `specialDoublePlacementIds`. La nueva colocación queda fuera de `mainLine`.
3. **Extensión de ramificación:** el objetivo es el extremo terminal de una cadena lateral existente. La nueva colocación queda fuera de `mainLine` y prolonga esa misma cadena.

Ningún otro origen de ramificación es legal por R-034 y R-035.

## Puertos ordinarios

Una ficha ordinaria, incluido un chancho no especial, expone dos puertos tradicionales:

```text
side:a
side:b
```

Cada puerto presenta el valor de su lado y acepta como máximo una conexión. Cuando la colocación pertenece a la línea principal, esos puertos participan en el recorrido principal. Cuando pertenece a una rama, uno enlaza con su predecesor y el otro puede ser el extremo terminal.

Los IDs corresponden directamente a los lados canónicos del catálogo. Para un doble ordinario, `side:a` es la entrada técnica al incorporarse a un tablero ocupado y `side:b` queda disponible. Esta convención resuelve la simetría sin introducir orientación visual.

## Puertos de un chancho especial

Una colocación especial de `N|N` expone:

```text
main:1    valor N
main:2    valor N
branch:1  valor N
branch:2  valor N
```

- `main:1` y `main:2` se reservan para continuidad del camino principal.
- `branch:1` y `branch:2` son los únicos orígenes posibles de cadenas laterales.
- Los cuatro nombres son lógicos y neutrales.
- Todos tienen valor N para R-028.
- Cada uno acepta como máximo una conexión.

La correspondencia técnica estable es `a → main:1` y `b → main:2`. Si el chancho especial se agrega a una línea existente, `main:1` recibe la conexión de entrada y `main:2` conserva la continuidad. En la primera colocación, ambos están libres. Esto no significa izquierda/derecha.

El número ordinal de una conexión del chancho no identifica un puerto específico: cuenta cuántos de sus cuatro puertos están ocupados. Por R-018 y R-033, el aporte es `2N` con 0 o 1 conexión y 0 con 2, 3 o 4.

## Condición especial persistida

`specialDoublePlacementIds` es la fuente normativa para saber qué colocaciones adquirieron capacidad de cuatro conexiones.

La lista:

- contiene solo colocaciones de chanchos;
- conserva el orden en que adquirieron la condición;
- tiene longitud máxima `effectiveK = min(K, 7)`;
- contiene únicamente IDs presentes en `mainLine.placementIds`;
- excluye todos los chanchos de ramificaciones;
- no cambia durante la partida, salvo que una futura regla autorice deshacer.

El historial permite auditarla, pero no es necesario para consultar la capacidad actual de una colocación.

## Ramificaciones derivadas

No se persisten `board.branches` ni `placement.region`.

Una ramificación es un componente del subgrafo formado por colocaciones fuera de `mainLine` que:

- se conecta a la línea principal una única vez;
- lo hace mediante `branch:1` o `branch:2` de un chancho especial;
- forma un camino simple;
- no se conecta con otra ramificación;
- no vuelve a conectarse con la línea principal;
- no contiene un nuevo origen `branch:*`.

La rama puede reconstruirse comenzando en una arista `branch:*` ocupada y recorriendo conexiones tradicionales hasta su extremo terminal. Su identidad es una proyección derivada del puerto de origen; no requiere ID persistido.

## Extremos actuales derivados

- Los dos extremos principales se derivan del primer y último elemento de `mainLine.placementIds`, sus puertos de continuidad y `connections`.
- Cada ramificación no vacía tiene un único extremo terminal derivado.
- Un puerto `branch:*` libre de un chancho especial es también un extremo legal capaz de iniciar una rama.
- La colección de extremos abiertos se deriva; no se persiste.

Cada extremo puede identificarse canónicamente por su pareja `placementId + portId`. Una proyección futura puede exponer un `openEndId` compuesto, pero no debe guardarlo si no añade información. La identidad individual es obligatoria para R-030: dos extremos con el mismo valor siguen siendo destinos diferentes.

La consulta implementada `getOpenEndTargets(state)` devuelve ese ID compuesto, valor, colocación, puerto y clase topológica. `getLegalPlays(state, playerId)` enumera el producto válido de cada ficha de la mano con cada destino compatible. `getDerivedBranches(state)` reconstruye cada cadena desde su puerto `branch:*` de origen.

En todo tablero válido no vacío, con `s` chanchos especiales, existen exactamente `2 + 2s` destinos abiertos. Por tanto, `2 + 2s ≤ 2 + 2·effectiveK ≤ 16`. Esta cuenta se refiere a puertos legalmente prolongables, no a términos de puntuación.

## Proyección al grafo de valores

El Modo Grafo futuro no cambia este modelo. Proyecta cada ficha colocada `[N|M]` como arista entre los vértices de valor N y M, o como lazo si `N = M`.

Esa proyección no es el grafo lógico del tablero:

- colapsa todas las apariciones de N en un único vértice;
- no conserva por sí sola línea principal, ramas ni extremos repetidos;
- no es un multigrafo porque cada ficha no ordenada existe una sola vez;
- necesita conservar referencias `dominoId` y `placementId`, más una superposición derivada de extremos abiertos.

El detalle matemático y los límites de multiplicidad están en [`modo-grafo.md`](modo-grafo.md).

## Información normativa y derivada

| Concepto | Tratamiento |
| --- | --- |
| Fichas colocadas | `placements` persistido |
| Aristas y puertos ocupados | `connections` persistido |
| Recorrido principal y orden | `mainLine.placementIds` persistido |
| Condición especial adquirida | `specialDoublePlacementIds` persistido |
| `placement.region` | Derivado; no persistir |
| `placement.role` | Derivado de la lista especial; no persistir |
| `board.branches` | Derivado; no persistir |
| Extremos abiertos | Derivado |
| ID de extremo abierto | Derivado de colocación y puerto |
| Agrupación de extremos por valor | Proyección del renderer |
| Grafo de valores `0–6` | Proyección del renderer |
| Aporte a S | Derivado del valor y número de conexiones |
| Coordenadas y rotación | Efímero del renderer |

## Ejemplos topológicos

Los casos normativos A–H están en `REGLAS.md`. Como resumen:

```text
mainLine.placementIds = [p1, p2, p3]

p1 —— p2 —— p3       camino principal
       |
       r1 —— r2       una rama derivada desde branch:*
```

`r1` y `r2` no están en `mainLine`; forman una sola cadena lateral y no pueden conectarse de nuevo a `p1`, `p3` ni a otra rama.
