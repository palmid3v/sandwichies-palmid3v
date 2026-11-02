# Firebase y autenticación

El proyecto Firebase configurado se identifica en `.firebaserc`; no contiene ni debe contener credenciales. Firebase Authentication identifica a clientes y administradores con correo y contraseña. Firestore conserva órdenes y tracking; el Worker valida ID tokens antes de ejecutar operaciones protegidas.

## Identidad compartida y verificación

La tienda y el panel importan la misma instancia `auth` y `db` desde `src/firebase.js`. No se crean sesiones anónimas ni una segunda app Firebase para clientes.

Todo usuario debe verificar su correo. El frontend renueva el ID token y comprueba `emailVerified` y `email_verified`; el Worker rechaza cualquier token sin `email_verified: true`; Firestore Rules exige el mismo claim para lecturas autenticadas. El acceso administrativo añade el custom claim `admin: true`.

Los clientes pueden registrarse, iniciar sesión y solicitar restablecimiento de contraseña desde la tienda. El inicio de sesión de una cuenta sin verificar vuelve a enviar el enlace de verificación y cierra la sesión hasta que el usuario verifique el correo.

## Rol de administración

La única convención es el custom claim `admin: true`:

```text
Firebase Auth user + verified email
  → admin custom claim
  → frontend guard
  → Worker admin guard
  → Firestore admin rules
  → /admin
```

La asignación/revocación se realiza con `npm run provision:admin` bajo credenciales autorizadas de Firebase Admin; revisar `SECURITY.md` antes de usarlo. El script no crea cuentas y rechaza asignar admin a cuentas con correo no verificado.

La contraseña y el claim son independientes. Un cambio/restablecimiento de contraseña no elimina el claim; tras cualquier cambio de claim hay que obtener un nuevo ID token.

## Reinicio de clientes

Las sesiones anónimas anteriores no se vinculan a cuentas nuevas. Los pedidos e historiales anónimos quedan fuera del flujo nuevo y no se reclaman automáticamente. No ejecutar borrados masivos de Auth o Firestore desde este cambio.

## Proveedor Firebase Console

El proveedor Email/Password debe estar habilitado en Firebase Console > Authentication > Sign-in method. El código no puede habilitarlo desde GitHub; confirmar esta configuración antes de validar el registro real.
