# Seguridad y Firebase

Las reglas de Firestore niegan escrituras públicas de pedidos y acceso del cliente al contador. Sólo un token con custom claim `admin: true` puede leer/actualizar pedidos desde el panel. La Cloud Function usa Admin SDK y por eso puede persistir la orden confiable.

El rol se asigna fuera de la UI mediante un proceso privilegiado de Firebase Admin SDK. Nunca publicar claves de servicio ni crear una pantalla pública para asignar roles. Validar estas reglas en Emulator Suite antes de release.

## Provisionar o revocar al administrador existente

La única convención de rol es el custom claim booleano `admin: true`. La misma clave se usa en el guard de `/admin` y en las reglas de Firestore. La función `createOrder` es pública para clientes por diseño; no es una operación administrativa y no concede lectura o gestión de pedidos.

Un operador autorizado, con credenciales de Firebase Admin para el entorno correcto, ejecuta:

```powershell
$env:ADMIN_EMAIL = "correo-del-administrador"
npm run provision:admin
```

Para revocar en PowerShell:

```powershell
$env:REVOKE_ADMIN = "true"
npm run provision:admin
```

El script busca ese usuario existente por correo y falla sin crear cuentas si no existe. Para revocar, ejecutar el mismo comando con `REVOKE_ADMIN=true`. Nunca incluir credenciales, contraseñas, UIDs hardcodeados ni roles en el frontend.

Después de asignar/revocar, el usuario debe cerrar sesión y volver a entrar o renovar su ID token. Restablecer la contraseña no elimina custom claims: autenticación y autorización son datos distintos. Verificar el rol iniciando sesión en `/admin`, confirmando carga de pedidos y comprobando que una cuenta autenticada sin claim recibe acceso restringido y denegación de Firestore.


## Inventory authorization

The collections `inventoryBalances` and `inventoryTransactions` are readable only by admins. Browser writes remain denied. Admin browser status changes must go through the trusted `transitionOrderStatus` callable; Firestore Rules block direct status writes. The callable deducts stock from Cupboard before confirming the order, restores it once on cancellation after confirmation, then mirrors the external result to Sandwichies. Completed-sale accounting remains separate and counts only delivered, paid orders.

## Virtual delivery authorization

Customer location submissions and arrival signals use callables. The backend validates active service-zone polygons, customer ownership and the current member state. Customer tracking is projected under `customerOrderTracking/{uid}/orders/{orderId}` and Firestore Rules limit reads to that UID; customers cannot read tables, members, zones or delivery events and cannot write delivery state. Admin claim `admin: true` is required for global operational reads and logistics mutations. Keep precise customer coordinates out of shared group views unless needed to navigate that specific order.

## Release flag discrepancy

As of 2026-10-30, `main` commit `270303d` sets `BUSINESS.acceptingOrders = true`, while release policy requires false pending the checklist. This is unresolved and blocks release. Do not deploy or create real orders as a validation method.
