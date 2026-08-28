# Variantes futuras

## Estado y autoridad

La única modalidad reglamentaria aprobada continúa siendo cuatro jugadores, dos equipos 2 vs 2, doble-seis completo, K y puntuación múltiplo de 5 conforme a R-001–R-035.

Todo lo descrito aquí es análisis de producto. No modifica reglas, snapshot ni motor. Una variante solo podrá implementarse después de formalizar sus propias reglas, invariantes, ejemplos y tests.

## Ejes independientes de configuración

Conviene evaluar las variantes como composición de ejes, no como nombres que mezclen comportamientos:

```text
RoundRules
├── scoringPolicy
├── topologyPolicy / K
└── participantPolicy

MatchRules
└── victoryPolicy

ViewPreferences
└── graph | traditional
```

La vista nunca modifica los otros ejes. No todas las combinaciones de reglas son coherentes.

## Divisible por n

### Hipótesis experimental

Para un entero positivo `n`, después de una jugada:

```text
si S = n·m, se conceden m = S/n puntos;
en otro caso, se conceden 0 puntos.
```

El modo aprobado es `n = 5`. La hipótesis no debe añadirse a `REGLAS.md` todavía.

Una futura arquitectura podría expresar una política como:

```js
{
  type: "divisible",
  divisor: 5
}
```

Esto no requiere generalizar ahora el snapshot v4. Cuando se implemente la puntuación aprobada, conviene concentrar el literal 5 dentro del módulo o política de puntuación, en vez de dispersarlo por tablero, UI e historial.

### Vacío que impide generalizarla hoy

R-023 también usa 5 para redondear la bonificación final. La propuesta “Divisible por n” solo define los puntos después de cada jugada; no determina si la bonificación:

- permanece basada en `a/5`;
- pasa a basarse en `a/n`;
- utiliza otra política;
- desaparece.

No debe inferirse ninguna opción. Una variante `n ≠ 5` permanece incompleta hasta resolver esta relación y producir ejemplos normativos.

### Valores a estudiar mediante simulación futura

| n | Clasificación preliminar | Motivo de estudio |
| ---: | --- | --- |
| 1 | No recomendable | Toda S puntúa y la divisibilidad deja de crear decisiones selectivas. |
| 2 | Experimental/control | Puntuación probablemente muy frecuente; útil como extremo comparativo. |
| 3 | Interesante para estudiar | Frecuencia alta pero aún selectiva. |
| 4 | Interesante para estudiar | Contraste cercano con el modo aprobado. |
| 5 | Recomendada y aprobada | Modalidad normativa actual. |
| 6 | Interesante para estudiar | Relación directa con el valor máximo de una cara; puede producir patrones propios. |
| 7 | Interesante para estudiar | Relación con los siete valores del grafo, sin garantía de buen equilibrio. |
| 8–10 | Experimental | Probable reducción de frecuencia; medir rondas sin puntuación y duración. |
| valores mayores | Experimental/no recomendable sin evidencia | Pueden volver la puntuación demasiado rara o efectivamente ausente. |

Los candidatos prioritarios para simulación serían `3, 4, 6 y 7`, usando `2` y `8–10` como controles. Las métricas deberían incluir frecuencia de jugadas puntuables, puntos por ronda, ventaja del jugador inicial, duración, bloqueos y efecto de K. Esta tabla no declara que ningún valor sea válido reglamentariamente.

## Sin divisibilidad

### Hipótesis experimental

- no se conceden puntos después de jugadas;
- en una partida de una ronda, el vencedor tradicional gana inmediatamente;
- si un tranque no produce vencedor tradicional, la ronda queda sin ganador salvo regla futura distinta.

Es una variante coherente como experiencia de una ronda y puede usar cualquiera de los dos renderers. No necesita calcular múltiplos, pero sigue necesitando extremos para legalidad y para explicar la topología.

Antes de autorizarla deben resolverse:

- tratamiento formal de una ronda sin vencedor;
- si existe o no bonificación y para qué se usaría;
- cómo cuentan empates en series;
- qué magnitud se acumularía en un match por puntos.

No corresponde reutilizar silenciosamente el marcador actual con ceros.

## Condiciones futuras de victoria

| Modalidad | Evaluación | Decisiones pendientes |
| --- | --- | --- |
| Una ronda | Recomendada como base | Distinguir ganador por puntaje final y vencedor tradicional según scoring policy. |
| Mejor de 3 | Interesante para estudiar | Primera pareja en dos rondas ganadas; definir rondas empatadas. |
| Mejor de 5 | Experimental | Primera pareja en tres rondas ganadas; mayor duración y abandono. |
| Meta acumulada | Interesante para Divisible | Definir qué puntaje se acumula, meta, sobrepaso, empate y nueva ronda. |
| 50 puntos | Candidato de simulación | Duración depende fuertemente de n y K. |
| 100 puntos | Candidato de simulación larga | Puede ser excesivo para juego local; requiere datos. |

“Mejor de” mide rondas ganadas; “meta” mide puntos. No conviene mezclarlos sin una razón de producto explícita.

## Coherencia de combinaciones

| Puntuación de ronda | Victoria del match | Evaluación |
| --- | --- | --- |
| Divisible por 5 | Una ronda | Recomendada; modalidad actual. |
| Divisible por 5 | Mejor de 3 | Coherente; falta política de empate de ronda. |
| Divisible por 5 | Mejor de 5 | Coherente, probablemente larga. |
| Divisible por 5 | Meta de puntos | Coherente; requiere reglas de acumulación. |
| Divisible por n | Una ronda | Conceptualmente coherente, pero incompleta por bonificación final. |
| Divisible por n | Mejor de 3/5 | Conceptualmente coherente después de cerrar la regla de ronda y empates. |
| Divisible por n | Meta de puntos | Coherente para simulación después de definir bonificación y acumulación. |
| Sin divisibilidad | Una ronda | Recomendada para prototipo futuro: decide el vencedor tradicional. |
| Sin divisibilidad | Mejor de 3/5 | Coherente si se define qué ocurre con rondas sin vencedor. |
| Sin divisibilidad | Meta de puntos | Incoherente con la propuesta actual: no existe una fuente de puntos que acumular. |

No se inventará una puntuación auxiliar para hacer funcionar la última combinación.

## Participantes y equipos

### Comparación material

| Configuración | Reparto equitativo de 28 | Impacto principal | Clasificación |
| --- | --- | --- | --- |
| 4 jugadores, 2 vs 2 | 7 cada uno, sin sobrantes | Reglamento y arquitectura actuales | Recomendada y central |
| 2 jugadores, 1 vs 1 | 14 cada uno, sin sobrantes | Manos muy grandes; altera pase, duración y bonificación | Interesante para estudiar |
| 3 jugadores, todos contra todos | Imposible repartir las 28 por igual | Requiere sobrante, pozo o reparto desigual | No recomendable sin rediseño completo |
| 4 jugadores, todos contra todos | 7 cada uno, sin sobrantes | Material encaja; cambia equipos, marcador y vencimiento | Interesante para estudiar a largo plazo |
| 7 jugadores, todos contra todos | 4 cada uno, sin sobrantes | Muchos turnos, UI densa y redefinición extensa | Experimental, baja prioridad |
| 5 o 6 jugadores | Sobran fichas con manos iguales | Requiere nuevas reglas de material | No recomendable para el alcance cercano |

### Impacto comparado de las alternativas principales

| Aspecto | 2 jugadores, 1 vs 1 | 3, todos contra todos | 4, todos contra todos |
| --- | --- | --- | --- |
| Mano/stock | 14 cada uno sin stock, o una regla nueva de pozo | 9 cada uno y 1 sobrante como mínimo; requiere regla nueva | 7 cada uno, sin stock |
| Orden | Alternancia de dos | Ciclo de tres | Conserva ciclo de cuatro |
| Pase/tranque | Umbral actual de cuatro no es reutilizable | Umbral actual no es reutilizable | Podría conservar cuatro pases por cardinalidad, pero debe formalizarse de nuevo |
| Vencedor tradicional | Puede reinterpretarse entre dos, pero necesita regla propia | Comparar tres manos y empates múltiples no está definido | Comparar cuatro manos y empates múltiples no está definido |
| Puntos | Marcador individual plausible | Marcador individual de tres | Marcador individual de cuatro |
| Bonificación | “equipo rival” podría ser el oponente, previa regla | No existe un único rival | No existe un único rival |
| Equilibrio | Mucha información y manos grandes; posible ventaja de control | Sobrante/pozo afecta azar e información | Material simétrico, pero alianzas tácticas informales y orden pueden pesar |
| Duración | Probablemente larga por 14 fichas | Incierta; depende de pozo y bloqueo | Similar o algo más corta que 2 vs 2, sin coordinación de pareja |
| Modo Grafo | Mismo grafo; mano ocupa más UI | Mismo grafo; tres identidades de color/foco | Mismo grafo; cuatro identidades de color/foco |
| Motor actual | Cambios amplios de cardinalidad, pases y resultado | Cambios máximos: material, stock, inicio, resultado | Reutiliza reparto/turno parcialmente; cambia equipos, score y cierre |
| Excepciones estimadas | Medias-altas | Muy altas | Medias-altas |

### 2 jugadores, 1 vs 1

- **Material:** admite 14 fichas por persona sin pozo; una mano inicial tan grande cambia información, selección y duración.
- **Turnos y bloqueo:** el ciclo es simple, pero cuatro pases consecutivos deja de ser una definición natural y no puede reutilizarse sin nueva regla.
- **Vencedor y bonificación:** equipos unitarios son posibles, pero requieren redacción propia.
- **Modo Grafo:** funciona sin cambios matemáticos; la UI de mano necesita mucha más capacidad.
- **Motor:** afecta cardinalidades, reparto, pase, validación y score; no justifica generalizar ahora el bloque aprobado.

### 3 jugadores, todos contra todos

- **Material:** `28 = 3·9 + 1`; el reparto completo y equitativo es imposible.
- **Pozo/sobrante:** cualquier solución crea reglas nuevas, incluido el riesgo de que `6-6` no esté en una mano.
- **Resultado:** “equipo rival” y bonificación dejan de tener significado directo.
- **Modo Grafo:** la vista de tablero sigue siendo válida, pero manos, colores e historial requieren tres identidades individuales.
- **Evaluación:** demasiadas excepciones para una primera expansión.

### 4 jugadores, todos contra todos

- **Material:** conserva exactamente siete fichas por persona, sin pozo.
- **Turnos:** conserva el ciclo de cuatro, pero desaparece la alternancia de compañeros.
- **Resultado:** puntuación, tranque, suma restante y bonificación necesitan reglas individuales nuevas; no es válido asumir “menor mano gana” en todos los casos.
- **Modo Grafo:** cambia poco; aristas e historial pueden colorearse por cuatro jugadores en vez de dos equipos.
- **Evaluación:** es la alternativa más limpia materialmente después del 2 vs 2, pero su coste reglamentario sigue siendo considerable.

### Otras configuraciones

Siete jugadores reparten exactamente cuatro fichas, pero complican el turno, los pases, la legibilidad local y el resultado. Equipos de tres o más jugadores no dividen el material de forma limpia y diluyen la identidad 2 vs 2. Ninguna justifica cambios preventivos en el motor.

## Recomendación de producto

Mantener 4 jugadores 2 vs 2 como núcleo. Priorizar, en este orden:

1. terminar y medir la modalidad aprobada;
2. prototipar visualmente Modo Grafo con la misma regla;
3. simular divisores alternativos sin publicarlos como modos;
4. evaluar Sin divisibilidad + una ronda;
5. considerar 4 jugadores todos contra todos solo con un reglamento completo;
6. posponer 1 vs 1 y descartar por ahora 3 jugadores o configuraciones con sobrantes.

La flexibilidad abstracta por sí sola no justifica condicionales, campos ni pantallas adicionales.

## Criterios para promover una variante

Una propuesta debería avanzar solo si demuestra:

- decisiones estratégicas diferenciadas;
- reglas y mensajes de UI comprensibles;
- duración y frecuencia de puntuación razonables;
- equilibrio medible;
- compatibilidad con la identidad del juego;
- coste asumible de tests, renderer, tutorial y mantenimiento.
