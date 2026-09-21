# Publicar MULTINÓ Online Alpha

El frontend es estático y usa rutas relativas, por lo que funciona tanto en
`localhost` como bajo `https://usuario.github.io/repositorio/`. El workflow
`.github/workflows/pages.yml` ejecuta tests, crea `dist/` y publica únicamente
ese artefacto. La carpeta `supabase/`, el repositorio y cualquier secreto quedan
fuera del sitio público.

## Checkpoint de Supabase

1. Crear un proyecto Supabase.
2. En Auth, habilitar **Anonymous Sign-Ins**.
3. Copiar **Project URL** y la clave **publishable/anon** de cliente.
4. Autenticar Supabase CLI localmente y enlazar este directorio al proyecto.
5. Aplicar `supabase/migrations/202609210001_online_alpha.sql`.
6. Desplegar `room-lobby` y `game-action` y configurar
   `SUPABASE_SERVICE_ROLE_KEY` solo como secret server-side de las funciones.
7. Ejecutar el harness end-to-end de dos navegadores antes de habilitar Alpha.

Nunca colocar la service-role key en GitHub Pages, `runtime-config.js`, variables
del frontend ni commits. Pages necesita únicamente estas Repository Variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLIC_KEY`

## Checkpoint de GitHub

Este checkout no tiene remote Git configurado. Henry debe elegir/crear el
repositorio, añadir el remote y habilitar **Settings → Pages → GitHub Actions**.
Después de revisar los commits, un push a `main` disparará el workflow.

## Verificación Alpha obligatoria

Con el backend real desplegado: crear sala en A, abrir el enlace en B, completar
los cuatro asientos con humanos/CPU, jugar una ronda, confirmar privacidad de
manos en Network, refrescar un cliente, verificar CPU con host desconectado y
comprobar que la partida terminada aparece en historial.
