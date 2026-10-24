# Sandwichies ↔ Cupboard: configuración y validación

La integración de Fase 3 está implementada en app/functions/cupboard-inventory.js y se ejecuta desde las callables administrativas de Functions. No se debe habilitar checkout ni desplegar Functions/Rules hasta completar esta lista.

## 1. Configuración requerida

Configurar como variables de entorno del runtime de Firebase Functions:

- CUPBOARD_PROJECT_ID: ID del proyecto Firebase de Cupboard (no la URL).
- CUPBOARD_HOUSEHOLD_ID: ID real del hogar dueño del espacio comercial en Cupboard.
- CUPBOARD_INGREDIENT_MAP_JSON: objeto JSON que asocia cada ID de ingrediente activo de Sandwichies con el ID de producto existente en households/{householdId}/workspaces/sandwichies/inventory/{productId}.

Ejemplo solo de formato; confirmar cada ID con datos reales antes de usarlo:

```json
{
  "pepperoni": "ID_REAL_PRODUCTO_CUPBOARD",
  "base": "ID_REAL_PRODUCTO_CUPBOARD"
}
```

Cada ingrediente activo debe tener un producto único. No se crean productos automáticamente: si falta un producto, la confirmación debe fallar sin cambiar el estado del pedido.

## 2. Catálogo único de productos

Cupboard es el catálogo canónico compartido. El script `scripts/sync-cupboard-catalog.mjs` registra las fichas de ingredientes activos de Sandwichies en `productCatalog/{productId}` usando el mapeo configurado. Primero verifica que todas las asociaciones sean uno-a-uno y que cada producto ya exista en el inventario comercial; no crea existencias ni altera cantidades o movimientos. Las fichas existentes se conservan sin sobrescribirlas.

Ejecuta primero la simulación:

```powershell
npm run cupboard:catalog-sync
```

Revisa la lista de fichas faltantes y luego aplica explícitamente:

```powershell
npm run cupboard:catalog-sync -- --apply
```

El script usa Application Default Credentials para el proyecto Cupboard. No imprime credenciales ni modifica el inventario. Los usuarios invitados solo pueden leer la identidad compartida de los productos; el inventario de Sandwichies permanece privado del propietario.

## 3. Preflight local sin conexión a Firebase

Desde D:\PALMI-D3V\projects\sandwichies-palmid3v\app, con las variables de entorno definidas para la sesión:

```powershell
npm run cupboard:preflight
```

El preflight valida variables, JSON, ingredientes sin mapear, IDs inválidos, productos duplicados y que el proyecto Cupboard no sea el proyecto runtime de Sandwichies. No consulta ni modifica Firebase y no despliega servicios.

## 3. Permisos y pruebas

1. Identificar la identidad real de ejecución de Functions y concederle únicamente el rol roles/datastore.user en el proyecto Cupboard.
2. Ejecutar npm run check en el entorno local.
3. Ejecutar la integración con Firestore/Functions emulados y revisar especialmente:
   - confirmación: todas las cantidades cambian una sola vez;
   - reintento: no duplica el movimiento;
   - cancelación tras confirmar: restaura exactamente el consumo;
   - cancelación antes de confirmar: no genera movimientos;
   - stock insuficiente o mapeo ausente: no confirma el pedido ni deja movimientos parciales;
   - compras y ajustes manuales: son idempotentes.
4. Revisar visualmente el stock en el espacio **Negocio · Sandwichies** de Cupboard y en el panel de Sandwichies.

Los proyectos Firebase separados no permiten una transacción distribuida única. La integración usa movimientos deterministas e idempotencia para recuperarse de reintentos; por eso los errores parciales deben probarse explícitamente.

## Límite de seguridad

No desplegar Functions/Rules, no activar pedidos y no usar pedidos reales como prueba hasta que la configuración y las pruebas estén verificadas. BUSINESS.acceptingOrders debe seguir en false.
