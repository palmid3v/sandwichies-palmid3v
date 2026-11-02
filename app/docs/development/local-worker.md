# Sandwichies Worker — desarrollo local

Este flujo conecta la interfaz de Sandwichies con el Worker real del repositorio, ejecutado localmente por Wrangler. Las operaciones de zonas, mesas y actividad se escriben/leen en **Firestore Emulator**, no en el Firestore productivo.

## Arquitectura local

```
Navegador (Vite :5182)
  ├─ Firebase Authentication (sesión existente; solo emite el ID token)
  └─ Worker API (Wrangler :8787)
       └─ Firestore Emulator (:8080)
```

- El Worker verifica el ID token Firebase del administrador contra el proyecto `sandwich-pro`.
- Solo el Worker local apunta al Firestore Emulator.
- El transporte local usa `Bearer owner` únicamente contra un host loopback y solo cuando `LOCAL_DEV=true`.
- La pantalla de Entregas obtiene zonas, mesas, miembros y actividad a través del Worker. No consulta directamente las colecciones productivas.
- `ORDERS_ENABLED` continúa en `false`. No se habilita checkout ni creación de pedidos.
- No se requiere service account para guardar zonas en el emulador.
- El resto del dashboard puede conservar sus lecturas Firebase existentes; esta configuración local aísla las operaciones de Entregas, no convierte automáticamente todas las pantallas en emuladas.

## Preparación (PowerShell)

Ejecutar desde `D:\PALMI-D3V\projects\sandwichies-palmid3v\app`.

### 1. Terminal — Firestore Emulator

```powershell
npm run emulator:firestore
```

El emulador usa el proyecto local `sandwich-pro` y escucha en `127.0.0.1:8080`. No se ejecuta ningún comando de deploy ni se escribe en Firestore remoto.

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

Copiar el archivo de entorno local:

```powershell
Copy-Item .env.local.example .env.local
npm run dev -- --host 127.0.0.1 --port 5182
```

Abrir `http://127.0.0.1:5182`, iniciar sesión con la cuenta administradora habitual y entrar en Administración → Entregas → Zonas.

El ID token de Firebase se usa solo para autenticar al administrador ante el Worker local. La persistencia de zonas, mesas y eventos de este flujo queda en el emulador local.

## Verificación funcional

1. Dibujar un polígono de al menos tres vértices.
2. Guardar la zona.
3. La lista debe actualizarse después del guardado (también se refresca cada 10 segundos).
4. Reiniciar el Worker no elimina los datos mientras el emulador siga activo.
5. Reiniciar Firestore Emulator sin export/import limpia el almacenamiento de prueba.

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
