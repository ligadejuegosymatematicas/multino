# Publicar MULTINÓ Online Alpha

El frontend es estático y usa rutas relativas, por lo que funciona tanto en
`localhost` como bajo `https://usuario.github.io/repositorio/`. El workflow
`.github/workflows/pages.yml` ejecuta tests, crea `dist/` y publica únicamente
ese artefacto. La carpeta `supabase/`, el repositorio y cualquier secreto quedan
fuera del sitio público.

## Estado de Supabase

El proyecto `kefdfpalennsnnfnjwpc` está enlazado, tiene Anonymous Sign-Ins
habilitado y recibió las migraciones versionadas de `supabase/migrations/`.
Las funciones `room-lobby` y `game-action` están desplegadas. Las funciones
prefieren las variables administradas por Supabase `SUPABASE_PUBLISHABLE_KEYS`
y `SUPABASE_SECRET_KEYS`, con compatibilidad para los nombres legacy que la
plataforma todavía suministra. No se configura ninguna clave privilegiada en
el navegador.

La comprobación integrada real se ejecuta con:

```powershell
node scripts/verify-supabase-alpha.mjs
```

El harness crea identidades anónimas y una sala efímera, prueba Realtime,
concurrencia, privacidad, reconexión, CPU servidor y completa una ronda.

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
