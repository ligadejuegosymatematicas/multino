# Normas de trabajo

1. No inventar reglas.
2. No modificar reglas indirectamente desde el código.
3. Si hay contradicción entre código y `REGLAS.md`, señalarla.
4. Antes de introducir una dependencia nueva, justificarla en el registro de decisiones.
5. Mantener motor y UI desacoplados.
6. Cada cambio significativo debe actualizar la documentación correspondiente.
7. Actualizar `CHANGELOG.md`.
8. No realizar refactors masivos sin necesidad.
9. Conservar compatibilidad con GitHub Pages mientras sea posible.
10. No avanzar de fase sin comprobar la fase anterior.

## Lista de control para cambios de motor

- Identificar las reglas `R-nnn` afectadas.
- Confirmar que no quedan ambigüedades ocultas.
- Actualizar modelo, invariantes y decisiones si cambia un contrato.
- Añadir tests con resultados normativos, no supuestos.
- Ejecutar todos los tests sin navegador.
- Registrar el cambio en `CHANGELOG.md`.

