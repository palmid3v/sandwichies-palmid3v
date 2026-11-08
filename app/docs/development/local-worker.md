# Sandwichies Worker — desarrollo local

Este flujo conecta la interfaz de Sandwichies con el Worker real del repositorio, ejecutado localmente por Wrangler. Las operaciones de zonas, mesas y actividad se escriben/leen en **Firestore Emulator**, no en el Firestore productivo.

## Arquitectura local

```
Navegador (Vite :5182)
  ├─ Firebase Authentication (proyecto sandwich-pro; emite el ID token)
  ├─ Firestore Web SDK → Firestore Emulator (:8080)
  └─ Worker API (Wrangler :8787)
       └─ Firestore Emulator (:8080)
```

- El Worker verifica el ID token Firebase del administrador contra el proyecto `sandwich-pro`.
El SDK web de Firestore y el Worker local apuntan al mismo Firestore Emulator. Las lecturas en tiempo real del panel admin tampoco consultan Firestore productivo durante Vite development.
- Firebase Authentication permanece en el proyecto `sandwich-pro` para emitir ID tokens reales; no se conecta Auth al emulador en este flujo.
- El transporte del Worker usa `Bearer owner` únicamente contra un host loopback y solo cuando `LOCAL_DEV=true`.
- El Worker local falla cerrado si falta `FIRESTORE_EMULATOR_HOST`, si el host no es loopback o si el project ID no coincide con `FIREBASE_PROJECT_ID`.
- `ORDERS_ENABLED=false` es el valor de seguridad en `wrangler.toml` y `.dev.vars.example`. No se habilita checkout ni creación de pedidos.
- No se requiere service account de Sandwichies para guardar zonas en el emulador.
- Los builds de producción no conectan Firestore Emulator; usan Firestore remoto. Nunca compilar producción con una variable de emulador.

## Preparación (PowerShell)

Ejecutar desde `D:\PALMI-D3V\projects\sandwichies-palmid3v\app`.

### 0. Preflight seguro (una sola vez por cambio de entorno)

```powershell
npm run local:preflight
```

El preflight crea `worker/.dev.vars` y `.env.local` desde sus plantillas solo si no existen; nunca sobrescribe archivos locales. Comprueba los dos bloqueos de pedidos, el proyecto Firebase esperado, que frontend y Worker apunten a loopback, y que estén disponibles las dependencias, Firebase CLI y Java. Si detecta una URL remota, un emulador mal configurado o un flag de pedidos distinto de `false`, se detiene.

Si el preflight falla, corrige el archivo local indicado y vuelve a ejecutarlo. No copies secretos de producción ni cambies los flags para hacerlo pasar.

### 1. Terminal — Firestore Emulator

```powershell
npm run emulator:firestore
```

El emulador usa el proyecto local `sandwich-pro` y escucha en `127.0.0.1:8080`. El comando importa automáticamente el último respaldo de `app/.emulator-data` y exporta los datos al detenerse con `Ctrl+C`. La primera ejecución inicia vacío; al detenerla normalmente crea el respaldo que se restaurará en el siguiente inicio. Esta carpeta está ignorada por Git. No se ejecuta ningún comando de deploy ni se escribe en Firestore remoto.

### 2. Terminal — Worker local

Copiar la configuración local de ejemplo una sola vez:

```powershell
Copy-Item worker/.dev.vars.example worker/.dev.vars
npm run worker:dev
```

Wrangler inicia el Worker en `http://127.0.0.1:8787`. Verificar:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/health
```

La respuesta debe indicar `status = ok` y `ordersEnabled = false`.

### 3. Terminal — frontend

Crear el archivo solo si todavía no existe. Si ya tienes un `.env.local`, conserva sus otras variables y agrega o actualiza únicamente la URL del Worker:

```powershell
if (!(Test-Path .env.local)) {
  Copy-Item .env.local.example .env.local
}
# En .env.local deben quedar:
# VITE_SANDWICHIES_WORKER_URL=http://127.0.0.1:8787
# VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
npm run dev -- --host 127.0.0.1 --port 5182
```

Abrir `http://127.0.0.1:5182`, iniciar sesión con la cuenta administradora habitual y entrar en Administración → Entregas → Zonas.

El ID token de Firebase se usa para autenticar al administrador ante el Worker local. Las lecturas directas de Firestore del dashboard y las escrituras del Worker quedan en el mismo emulador local.

## Verificación funcional

1. Dibujar un polígono de al menos tres vértices.
2. Guardar la zona.
3. La lista debe actualizarse después del guardado.
4. Detener el emulador con `Ctrl+C` y volver a ejecutar `npm run emulator:firestore`; la zona debe seguir presente tras importar el respaldo.
5. Verificar que el navegador admin lee las colecciones del emulador y no datos del Firestore productivo.
6. Confirmar que `/health` responde con `ordersEnabled = false` en el Worker local.

Los endpoints administrativos nuevos son:

- `GET /v1/admin/delivery-operations`
- `GET /v1/admin/virtual-tables/:id/members`
- `POST /v1/admin/delivery-zones`

La respuesta de miembros omite `customerUid`; los eventos administrativos omiten `actorUid`.

## Migración posterior a Cloudflare

La interfaz conserva la misma URL base y los mismos contratos HTTP. Para Cloudflare:

1. Revisar y aprobar IAM, service accounts y secretos independientes de Sandwichies y Cupboard.
2. Configurar los secretos en Cloudflare; nunca copiarlos a `.env.local`, `.dev.vars` ni al repositorio.
3. Revisar el allowlist CORS y límites de Workers Free.
4. Desplegar solo con autorización explícita.
5. Cambiar `VITE_SANDWICHIES_WORKER_URL` en el entorno de hosting a la URL real verificada del Worker.
6. Mantener `ORDERS_ENABLED=false` hasta cerrar la validación integral y obtener autorización separada.

No inventar el hostname de Cloudflare, no habilitar Firebase Blaze y no ejecutar despliegues desde este procedimiento.
