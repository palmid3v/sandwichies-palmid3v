# Pruebas

Ejecutar desde `app/`:

```text
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Las pruebas actuales verifican precios, tamaño, consumo, extras, domicilio y solicitudes forjadas. Aún falta configurar Emulator Suite para reglas, roles, callable function y concurrencia del contador.
