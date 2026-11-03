# Firebase y autenticación

El proyecto Firebase configurado se identifica en `.firebaserc`; no contiene ni debe contener credenciales. Firebase Authentication identifica a clientes y administradores con correo y contraseña. Firestore conserva órdenes y tracking; el Worker valida ID tokens antes de ejecutar operaciones protegidas.

## Identidad compartida y verificación

La tienda y el panel importan la misma instancia `auth` y `db` desde `src/firebase.js`. El flujo actual no crea sesiones anónimas nuevas. Si existe una sesión anónima heredada en Firebase Auth, la tienda la conserva en pantalla de autenticación y permite vincularla con una credencial Email/Password mediante `linkWithCredential`; la vinculación conserva el mismo UID y, por tanto, la propiedad de los documentos ya guardados bajo ese UID.

Todo usuario que acceda a operaciones protegidas debe verificar su correo. El frontend renueva el ID token y comprueba `emailVerified` y `email_verified`; el Worker rechaza cualquier token sin `email_verified: true`; Firestore Rules exige el mismo claim para lecturas autenticadas. El acceso administrativo añade el custom claim `admin: true`.

Los clientes pueden registrarse, iniciar sesión y solicitar restablecimiento de contraseña desde la tienda. El registro enlaza la cuenta temporal existente cuando corresponde; si no hay sesión anónima, crea una cuenta nueva. Después de enviar la verificación, la sesión se cierra hasta que el usuario verifique el correo y vuelva a iniciar sesión.

Si el correo ya pertenece a otro UID, Firebase no permite enlazar esa credencial a la sesión anónima. La aplicación no fusiona documentos de dos UID automáticamente: se debe iniciar sesión con la cuenta existente y planificar una migración de datos autorizada, sin borrar ni reasignar documentos de forma implícita.

## Aislamiento Firestore local / producción

En Vite development, `src/firebase.js` conecta el SDK web de Firestore al emulador loopback `127.0.0.1:8080` (configurable solo con `VITE_FIRESTORE_EMULATOR_HOST` apuntando a `localhost` o `127.0.0.1`). Firebase Authentication permanece conectado al proyecto Firebase configurado para emitir ID tokens reales. El Worker local exige `LOCAL_DEV=true` y un `FIRESTORE_EMULATOR_HOST` loopback con el mismo project ID que `FIREBASE_PROJECT_ID`; si falta el host en modo local, falla cerrado y no usa Firestore remoto.

En builds de producción, el SDK web usa Firestore remoto y no permite activar el emulador. Wrangler mantiene `ORDERS_ENABLED=false` por defecto. No se habilitan pedidos reales ni se despliega backend como parte del desarrollo local.

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

## Reinicio y continuidad de clientes

La vinculación de una sesión anónima heredada conserva el UID; no es una migración entre dos cuentas. Los datos que no estén asociados a ese UID no se reclaman automáticamente. No ejecutar borrados masivos de Auth o Firestore.

## Proveedor Firebase Console

El proveedor Email/Password debe estar habilitado en Firebase Console > Authentication > Sign-in method. El código no puede habilitarlo desde GitHub; confirmar esta configuración antes de validar el registro real.
