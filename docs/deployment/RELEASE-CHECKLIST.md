# Checklist de release

1. Revisar cambios de catálogo y ejecutar pruebas.
2. Ejecutar lint, test, build y audit.
3. Validar funciones y reglas con emulador.
4. Verificar custom claims de administradores en el entorno objetivo.
5. Desplegar función y reglas sólo con aprobación explícita.
6. Ejecutar prueba de humo: pedido válido, pedido inválido, usuario no admin, admin y flujo WhatsApp.
7. Conservar la versión previamente desplegada para rollback.

No almacenar secretos en el repositorio.
