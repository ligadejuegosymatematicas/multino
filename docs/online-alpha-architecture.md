# MULTINÓ Online Alpha

## Frontera autoritativa

El cliente envía solamente `START_MATCH`, `PLAY_TILE` o `PASS` junto con la
versión que observó. La función servidor autentica el JWT anónimo, resuelve el
asiento y aplica el motor compartido de `src/js/game`. PostgreSQL confirma el
cambio con compare-and-swap; una versión vieja se rechaza como
`STALE_VERSION`.

`match_state_private` guarda el snapshot completo y no tiene ninguna policy de
lectura para `anon`/`authenticated`. `matches.public_state` y `moves` contienen
solo tablero, conteos y consecuencias ya públicas. Cada respuesta añade solo
la mano del asiento autenticado. Las CPU se resuelven dentro de la función
servidor y no dependen del navegador anfitrión.

Realtime anuncia cambios lógicos de versión. Cada cliente vuelve a solicitar
su vista pública+privada y reproduce localmente Tradicional, Puertos, Grafo y
el feedback de puntuación; no se sincronizan animaciones.

## Identidad y reconexión

La Alpha usa Supabase Anonymous Auth. `auth.uid()` queda asociado a
`room_seats.user_id`; un refresh conserva la sesión anónima y recupera el mismo
asiento. Cambiar un asiento humano conectado a CPU está prohibido por el
servicio. La futura conversión a cuenta permanente puede conservar el mismo
perfil.

## Límite actual

La migración, RLS, adaptador y función están preparados, pero no se consideran
desplegados ni probados contra un proyecto real hasta que exista un proyecto
Supabase configurado por Henry. La creación transaccional inicial de sala y
partida deberá validarse end-to-end durante ese checkpoint.
