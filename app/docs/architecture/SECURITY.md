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

The collections `inventoryBalances` and `inventoryTransactions` are readable only by admins. Browser writes remain denied. The trusted Functions runtime creates transaction records and updates balances. Completed-sale consumption is generated server-side after an order reaches the approved completed-sale state.
