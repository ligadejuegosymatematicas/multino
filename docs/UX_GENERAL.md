# UX general: inventario y límites

## Antes de este bloque

- Portada, configuración local, entrada online y lobby eran secciones ocultables.
  No había `popstate`/`pushState`; `replaceState` solo añadía/quitaba `?room=`.
  Los dos botones Volver llamaban a portada y borraban la referencia local de sala.
- PLAYING no tenía salida explícita. Local conserva la ronda solo en memoria:
  localStorage guarda perfil e historial de rondas terminadas, no una ronda activa.
- Online conserva Auth anónimo en el cliente y sala/asiento/match en servidor.
  GET_ROOM/SYNC_MATCH recuperan la membresía existente, sin JOIN adicional.
- FINISHED utiliza el mismo render de resultado Local/Online: ganador o empate,
  marcador y nombres de equipos, salida/tranque, bonus si positivo y vencedor
  previo al bonus si difiere. Los puntos de la última jugada pertenecen al scoring
  anterior y no se duplican aquí. No es un modal separado.
- Solo Local mostraba `Jugar otra` (nuevo reparto, mismos asientos/modo/vista) y
  `Cambiar configuración`. Online no tenía botones finales.
- No existen rematch/reordenamiento online: `room-lobby` acepta CREATE_ROOM,
  JOIN_ROOM, GET_ROOM y SET_SEAT_CONTROL. SQL exige LOBBY para configurar/iniciar;
  no hay transición FINISHED → LOBBY. No se añaden intenciones ficticias.

## Navegación y salida

El historial contiene rutas e índices, nunca manos, tokens ni snapshots. Back
restaura temporalmente la entrada actual antes de confirmar; cancelar no añade
entradas. Aceptar atraviesa una vez a su destino original. FINISHED no confirma.
Se conserva un inicio interno al abrir una invitación directa.

Salir online solo desconecta la presentación/suscripción local. Conserva código,
Auth y asiento; no envía LEAVE, no cambia control ni resultado. La entrada online
ofrece `Volver a mi sala` además de crear/unirse. Una portada visitada explícitamente
no reabre automáticamente esa sala al refrescar; la URL de sala sí la recupera.

Salir local elimina la ronda en memoria y cancela su tarea pendiente. Conserva
configuración e historial terminado; el diálogo advierte que no puede retomarse.

## Resultado y acciones finales

El resultado y sus acciones aparecen únicamente después del scoring y settle
existentes, con ganador/empate, marcador por equipos, motivo y bonus preservados.
Local: `Jugar de nuevo` conserva asientos/modo/vista y reinicia marcador/reparto;
`Cambiar configuración` conserva la posibilidad existente de editar la mesa;
`Volver al inicio` abre portada. No se añade reordenamiento online a Local.

Online: `Volver al inicio`. Se informa que una nueva partida requiere crear otra
sala y compartir su código. No se ofrecen `Jugar de nuevo` ni `Reordenar asientos`
porque requieren una transición de servidor que no existe. La sala terminada
sigue recuperable mediante su código, también después de salir a portada.

## Copy público final

| Antes | Después |
|---|---|
| Dominó, estrategia y múltiplos. | Dominó, estrategia y múltiplos de 5. |
| Salas privadas online disponibles. | Eliminado cuando online está configurado. |
| Elige la estructura de la ronda y cómo quieres ver el tablero. | Configura la ronda y elige cómo verla. |
| El primer chancho jugado… | En Ramificado, el primer doble jugado es el único que puede recibir hasta cuatro conexiones. |
| Todos los chanchos son ordinarios… | En Lineal, la mesa forma una sola cadena y cada doble admite dos conexiones. |
| Mesa local · equipos alternados | Jugadores |
| Siempre 4 jugadores · los equipos A y B ocupan asientos alternados. | 4 jugadores · compañeros de equipo frente a frente. |
| Jugar (configuración) | Empezar partida |
| Puntuación: múltiplos de 5 | Se puntúa con múltiplos de 5. |
| Sala online | Jugar online |
| Crea una sala privada o abre una invitación. | Crea una sala privada o únete con un código. |
| Tu nick | Nombre de jugador |
| Crear una sala privada + Crear sala | Crear sala |
| Unirse con código | Código de sala |
| Inspección topológica cerrada. | Detalle cerrado. |

Vista inicial: Tradicional / Estrategia / Grafo, sin cambiar el default Tradicional.
Se conservan nombres de equipos, asientos, Σ y la leyenda matemática compartida.

## Estudio de «Ver estructura» (decisión: conservar)

Auditoría de `PortRenderer.render`, `renderPortSvgMarkup`, `createPortScene` y
`GraphRenderer.renderGraphSvgMarkup`:

1. El toggle cambia exclusivamente `PortRenderer.structureVisible`; no envía
   acciones al controlador ni modifica el snapshot. Cambia el rótulo a
   `Volver a jugar` y reduce la tapa central para exponer el dibujo interior.
2. Muestra hilos externos de fichas ya jugadas, puentes internos de continuidad,
   incidencias de cada valor, hubs dobles con sockets y puntas individuales.
3. Al pulsar un medallón en ese modo abre un detalle ampliado: seis incidencias
   posibles, parejas de continuidad, sockets del doble, destinos y resumen de
   conexiones. Los endpoints jugables siguen siendo los mismos targets legales.
4. Permite inspeccionar un recorrido y volver a jugar; no agrega ninguna acción
   reglamentaria. Sin el toggle, los medallones y sus decisiones estratégicas ya
   permiten realizar las jugadas y ver previews locales.
5. Grafo sí duplica las fichas/aristas, lazos, familias y puntas. Pero colapsa cada
   valor en un vértice: NO dibuja las parejas internas de incidencias ni ofrece
   su inspector ampliado. Por ello el toggle no es una copia completa de Grafo.

Conclusión: innecesario para un principiante al decidir, pero contiene información
analítica única. Se conserva sin cambios; no se elimina ni el toggle ni su estado.
Propuesta para una decisión posterior: acceso secundario bajo ayuda avanzada,
con nombre `Detalle de conexiones`, fuera del flujo principal de jugada. Este
bloque no introduce otro rediseño ni mueve la información a Grafo.
