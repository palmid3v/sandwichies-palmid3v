# Seguridad y autenticación

## Política de identidad

Sandwichies utiliza una sola instancia de Firebase Authentication y una sola base de sesión para clientes y administradores. El único método permitido es correo electrónico + contraseña. Todo usuario debe verificar su dirección de correo antes de acceder a la tienda autenticada, consultar seguimiento, crear pedidos o entrar al panel.

- No se crean sesiones anónimas.
- No se vinculan ni migran pedidos asociados a UID anónimos anteriores.
- El nuevo registro crea una identidad nueva; el historial anterior queda fuera del flujo nuevo.
- La verificación se valida en el cliente, en el Worker (ID token Firebase verificado criptográficamente) y en Firestore Rules.
- La autorización administrativa requiere además el custom claim booleano `admin: true`.
- La verificación de correo es un claim reservado de Firebase; nunca se asigna como custom claim.

## Flujo de cliente

1. El cliente crea una cuenta con correo y contraseña.
2. Firebase envía un enlace de verificación.
3. La sesión no obtiene acceso a la tienda hasta que el correo esté verificado y el ID token refleje `email_verified: true`.
4. El cliente puede iniciar sesión, solicitar restablecimiento de contraseña y reenviar la verificación.
5. Los pedidos y el seguimiento quedan asociados al UID autenticado de esa cuenta nueva.

## Flujo administrativo

El administrador inicia sesión con correo y contraseña verificados. La UI exige `emailVerified === true` y `email_verified === true` en el ID token, además del claim `admin: true`. El Worker y Firestore repiten la autorización en el servidor.

Provisionar o revocar el claim sólo para una cuenta existente:

```powershell
$env:ADMIN_EMAIL = "correo-del-administrador"
npm run provision:admin
```

Para revocar:

```powershell
$env:REVOKE_ADMIN = "true"
npm run provision:admin
```

El script rechaza asignar el rol a cuentas con correo no verificado. Nunca incluir credenciales, contraseñas, UIDs hardcodeados ni roles en el frontend.

## Controles por capa

- **Frontend:** comparte `auth` y `db` desde `src/firebase.js`; no ejecuta `signInAnonymously`.
- **Worker:** toda ruta autenticada rechaza tokens sin `email_verified === true` con HTTP 403 y código `email-not-verified`. Las rutas de salud y preflight CORS siguen siendo públicas.
- **Firestore:** `isSignedIn()` exige sesión y correo verificado; `isAdmin()` añade `admin: true`.
- **Pedidos:** el Worker deriva la identidad del UID del token verificado; el navegador no puede escribir pedidos directamente.
- **Inventario:** las colecciones `inventoryBalances` y `inventoryTransactions` son de lectura administrativa y escritura exclusiva del servidor.
- **Seguimiento:** `customerOrderTracking/{uid}/orders/{orderId}` sólo puede ser leído por el UID propietario verificado o por un administrador.

## Datos anteriores y reinicio

La nueva autenticación no reclama ni migra usuarios anónimos, pedidos o historiales previos. No se ejecuta ninguna eliminación masiva de Firestore/Auth desde el código. Si se decide borrar datos antiguos del proyecto Firebase, deberá ser una operación separada, explícita y revisada en el entorno correcto.

## Release y costos

No desplegar, activar pedidos reales, habilitar servicios de pago ni realizar escrituras de producción durante esta tarea. Mantener el presupuesto en $0 y `BUSINESS.acceptingOrders` desactivado hasta cerrar el checklist de release.

## Validación pendiente

Ejecutar lint, pruebas unitarias, Worker tests, Firestore Rules Emulator, build y smoke tests. Confirmar en Firebase Console que el proveedor Email/Password está habilitado. El cambio de código no habilita automáticamente el proveedor en Firebase Console.
