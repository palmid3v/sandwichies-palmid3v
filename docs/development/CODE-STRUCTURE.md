# Estructura de código

- `src/`: React, estilos y adaptadores de interfaz.
- `shared/`: dominio reutilizable y fuente de verdad.
- `functions/`: frontera backend confiable.
- `test/`: pruebas de dominio y validación.
- `docs/`: evidencia, decisiones y trazabilidad.

Los adaptadores en `src/data`, `src/config` y `src/utils/pricing` no deben añadir reglas de negocio; sólo exponen el dominio a la UI.

La limpieza de activos y compatibilidad está documentada en `CLEANUP.md`.
