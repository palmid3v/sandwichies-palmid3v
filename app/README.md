# Sandwichies — App Context

**Estado:** desarrollo y pruebas locales; no listo para recibir pedidos reales.  
**Rama de trabajo:** `main`  
**Proyecto Firebase configurado:** `sandwich-pro` (`app/.firebaserc`).

## Propósito

Aplicación React para catálogo y configuración de sándwiches, cálculo de precios y costos confiables, checkout, administración de pedidos y seguimiento estimado de inventario.

## Funcionalidades actuales

### Cliente
- Catálogo y configurador de productos existentes, con tamaños de 15 cm y 30 cm.
- Carrito, selección de recogida o domicilio, datos del cliente y método de pago.
- Sesión anónima de Firebase separada de la sesión de administración.
- El nombre se solicita en checkout y se guarda en el perfil de la sesión anónima para prefijar futuras visitas mientras esa identidad siga disponible.
- Validación de teléfono móvil colombiano como dato de contacto; el checkout no depende de verificación por SMS.
- La confirmación final del pedido depende de que la Cloud Function esté desplegada y disponible.

### Administración
- Firebase Authentication con correo/contraseña y custom claim `admin: true`.
- Lectura de pedidos e inventario para administradores.
- Actualizaciones de estado y estado de pago limitadas por reglas.
- No se permite crear/eliminar pedidos directamente desde el navegador ni editar desde cliente los totales, costos, utilidad, datos del cliente, receta o snapshots de inventario.

### Pedidos e inventario
- `createOrder`: reconstruye el pedido con datos confiables del servidor, calcula el consecutivo y guarda el pedido mediante transacción.
- `recordInventoryTransaction`: registra movimientos manuales y exige custom claim de administrador.
- `syncCompletedSaleInventory`: intenta registrar consumo físico cuando una venta queda entregada y pagada; usa IDs deterministas de movimientos para evitar duplicarlos en reintentos.
- La cobertura de domicilio usa un radio configurado de 10 km y revisión manual; no rechaza automáticamente por coordenadas ausentes o fuera del radio.

## Arquitectura

- `src/`: interfaz React/Vite, páginas y componentes.
- `shared/catalog.js`: catálogo e ingredientes.
- `shared/pricing.js`: precios, costos, extras y cálculo de totales.
- `shared/business.js`: datos del negocio, aceptación de pedidos, estados y transiciones.
- `shared/order-request.js`: validación y reconstrucción confiable del pedido.
- `shared/inventory.js`: validación de movimientos y consumo de ingredientes.
- `functions/index.js`: Cloud Functions callable y trigger de inventario.
- `firestore.rules`: permisos del navegador y protección de datos operativos.
- `test/`: pruebas unitarias y pruebas de reglas.
- `scripts/`: utilidades de validación y administración.
- `docs/`: documentación de arquitectura, seguridad, costos/precios, operaciones y evolución del proyecto.

## Estado de Firebase y límites de despliegue

- La configuración local apunta a `sandwich-pro`; el alias predeterminado está en `app/.firebaserc`.
- La autenticación anónima está habilitada en Firebase Authentication.
- El usuario administrador existente tiene el custom claim `admin: true`.
- `BUSINESS.acceptingOrders` está actualmente en `true`, pero **esto por sí solo no habilita pedidos en la nube**.
- A fecha de la última revisión, `firebase functions:list --project sandwich-pro` respondió `No functions found`. Por tanto, las funciones de `functions/index.js` están en el repositorio, pero no desplegadas en ese proyecto.
- La consulta de Cloud Functions devolvió previamente `SERVICE_DISABLED` para `cloudfunctions.googleapis.com`. Hay que revisar cualquier requisito de facturación antes de activar servicios.
- No desplegar funciones ni reglas, no habilitar facturación y no enviar pedidos reales sin revisión y autorización explícitas. Priorizar pruebas con Firebase Emulator Suite y el proyecto demo `demo-sandwichies`.

## Seguridad

Las reglas actuales:
- niegan acceso a clientes no autenticados y a usuarios sin claim de administrador;
- permiten a administradores leer pedidos e inventario;
- limitan cambios de pedidos a estado, estado de pago y `updatedAt`;
- bloquean escritura desde navegador en contadores y colecciones de inventario;
- niegan cualquier acceso no declarado explícitamente.

No reemplazar estas reglas por reglas abiertas como `allow read, write: if true`. Las Cloud Functions usan Admin SDK y deben validar autorización y datos en el servidor.

## Precios y costos

Los precios de venta, costos de ingredientes, extras, domicilios y cálculos de utilidad deben mantenerse centralizados en los módulos `shared/`, no confiarse al navegador. `createOrder` reconstruye los importes a partir de la configuración enviada y no debe aceptar totales, costos, utilidad ni consecutivos enviados por el cliente como fuente de verdad.

## Comandos de desarrollo y verificación

Desde `app/`:

```powershell
npm install
npm run dev
npm run lint
npm test
npm run security:test
npm run build
npm run smoke
npm run check
```

- `npm test`: pruebas unitarias de dominio.
- `npm run security:test`: inicia Firestore Emulator en el puerto 8080 y ejecuta las pruebas de reglas con el proyecto demo.
- `npm run check`: auditoría de dependencias, lint, pruebas unitarias, seguridad, build y smoke test.
- Para `security:test`, Java debe estar instalado y disponible en `PATH`.

## Última validación reportada

El 19 de octubre de 2026:
- Pruebas unitarias: **26 aprobadas, 0 fallidas**.
- Pruebas de reglas en Firestore Emulator: **8 aprobadas, 0 fallidas**.
- La prueba de seguridad se corrigió para actualizar `payment.status` mediante notación de campo (`"payment.status"`) en vez de reemplazar el mapa `payment` completo.
- No se ha confirmado todavía una ejecución posterior de lint, auditoría, build y smoke test después de esos cambios.
- No se ha confirmado una prueba integral de checkout contra el emulador de Functions ni hay funciones desplegadas en `sandwich-pro`.

## Siguiente trabajo recomendado

1. Ejecutar `npm run check` en el entorno local actualizado y resolver cualquier fallo.
2. Preparar pruebas de Cloud Functions en emuladores locales para `createOrder`, validación de datos falsificados, asignación del consecutivo y movimientos de inventario.
3. Verificar el flujo completo del checkout sin tocar datos de producción.
4. Revisar los requisitos y posibles costos de Cloud Functions antes de cualquier activación o despliegue.
5. Solo después de aprobar seguridad, costos y configuración, decidir si se autoriza un despliegue de pruebas.

## Trazabilidad

El historial completo de cambios se conserva en Git. Los commits recientes incluyen la separación de sesiones anónimas de cliente y administrador, el checkout sin verificación SMS, la activación del flujo de pedidos para pruebas y la corrección de una prueba de reglas. Consultar el historial de `main` para ver cada cambio y su diff.

---

**Fuente de verdad:** código y configuración actuales del repositorio. Este README resume el estado observado y no sustituye la validación de los emuladores ni una revisión de Firebase Console.
