# Sandwichies ↔ Cupboard: configuración y validación

La integración de Fase 3 está implementada en `app/functions/cupboard-inventory.js` y se ejecuta desde las callables administrativas de Functions. No se debe habilitar checkout ni desplegar Functions/Rules hasta completar esta lista.

## 1. Identificadores del proyecto

- `CUPBOARD_PROJECT_ID`: ID del proyecto Firebase de Cupboard.
- `CUPBOARD_HOUSEHOLD_ID`: ID del hogar propietario en Cupboard.
- La configuración del runtime de Sandwichies debe apuntar al proyecto correcto y tener credenciales ADC autorizadas para acceder a Cupboard.

## 2. Crear fichas iniciales del catálogo compartido

Cupboard es el catálogo canónico compartido. El script `scripts/sync-cupboard-catalog.mjs` prepara fichas para cada ingrediente activo definido en `shared/catalog.js`, con IDs estables prefijados como `sandwichies-base`, `sandwichies-mozzarella` y `sandwichies-pepperoni`.

El script:
- crea solo documentos faltantes en `productCatalog/{productId}`;
- conserva cualquier ficha que ya exista, sin sobrescribirla;
- usa el nombre y la unidad inicial definidos en Sandwichies para que el propietario pueda editar las fichas después;
- no crea ni modifica documentos de inventario, existencias, compras o movimientos.

Configura un archivo local `.env` dentro de `app` con estos valores:

```dotenv
CUPBOARD_PROJECT_ID=cupboard-app-ce528
CUPBOARD_HOUSEHOLD_ID=e68b4d69-ef73-4a21-913a-ee1ad3b8a14b
```

No subas ese archivo a Git. El script usa Application Default Credentials; antes de ejecutarlo, inicia sesión con una identidad de Google Cloud autorizada para leer el hogar y crear fichas en el catálogo de Cupboard.

Primero ejecuta la simulación y revisa los IDs y nombres:

```powershell
npm run cupboard:catalog-sync
```

Solo si la simulación muestra las fichas esperadas, créalas explícitamente:

```powershell
npm run cupboard:catalog-sync -- --apply
```

## 3. Mapeo operativo del inventario (paso separado)

Crear una ficha en `productCatalog` no crea un artículo con cantidades en `households/{householdId}/workspaces/sandwichies/inventory/{productId}`. Tampoco enlaza automáticamente pedidos ni movimientos entre los dos proyectos.

Antes de activar pedidos o desplegar la integración, hay que revisar los documentos de inventario del espacio comercial y configurar `CUPBOARD_INGREDIENT_MAP_JSON` en el runtime de Functions con asociaciones verificadas. Cada ingrediente activo debe mapearse al ID real del documento de inventario que usará la integración. No deducir ese mapa únicamente por el nombre del producto.

## 4. Pruebas y permisos

1. Identificar la identidad real de ejecución de Functions y concederle solo los permisos necesarios en Cupboard.
2. Ejecutar `npm run check` en Sandwichies.
3. Probar con Firestore/Functions emulados:
   - confirmación: las cantidades cambian una sola vez;
   - reintento: no duplica movimientos;
   - cancelación tras confirmar: restaura exactamente el consumo;
   - cancelación antes de confirmar: no genera movimientos;
   - stock insuficiente o mapeo ausente: no confirma el pedido ni deja movimientos parciales;
   - compras y ajustes manuales: son idempotentes.
4. Revisar el inventario en **Negocio · Sandwichies** de Cupboard y en el panel de Sandwichies.

Los proyectos Firebase separados no permiten una transacción distribuida única. La integración usa movimientos deterministas e idempotencia para recuperarse de reintentos; por eso los errores parciales deben probarse explícitamente.

## Límite de seguridad

No desplegar Functions/Rules, no activar pedidos y no usar pedidos reales como prueba hasta que la configuración y las pruebas estén verificadas. `BUSINESS.acceptingOrders` debe seguir en `false`.
