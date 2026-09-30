# Firebase y acceso administrativo

El proyecto Firebase configurado se identifica en `.firebaserc`; no contiene ni debe contener credenciales. Firebase Auth identifica usuarios, Firestore conserva órdenes y la callable `createOrder` persiste órdenes reconstruidas por el backend.

## Rol de administración

La única convención es el custom claim `admin: true`:

```text
Firebase Auth user → admin custom claim → frontend guard → Firestore admin rules → /admin
```

La asignación/revocación se realiza con `npm run provision:admin` bajo credenciales autorizadas de Firebase Admin; revisar `SECURITY.md` antes de usarlo. El script no crea cuentas y no se debe ejecutar con credenciales del entorno equivocado.

La contraseña y el claim son independientes. Un cambio/restablecimiento de contraseña no elimina el claim; tras cualquier cambio de claim hay que obtener un nuevo ID token.
