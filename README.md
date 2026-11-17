# 🥪 𝐒𝐚𝐧𝐝𝐰𝐢𝐜𝐡𝐢𝐞𝐬 — Pedidos y operación gastronómica

> **PALMI-D3V** · Storefront mobile-first y consola de operación del negocio.

## 🎯 Misión

Gestionar el catálogo, configuración, precios y operación de un negocio de sándwiches, con flujos de cliente y administración seguros.

## 🔭 Visión

Convertirse en una plataforma operativa lista para apoyar el negocio y su integración con Cupboard. La recepción de pedidos está habilitada en el código para pruebas controladas autorizadas por el propietario; esto no equivale a un lanzamiento comercial.


## 🌐 Despliegue en Vercel

- **URL de producción:** https://sanpalmid3v.vercel.app
- **Proyecto Vercel:** `sandwichies-palmid3v`
- **Repositorio GitHub:** [`palmid3v/sandwichies-palmid3v`](https://github.com/palmid3v/sandwichies-palmid3v)
- **Alias verificado:** dominio asociado al despliegue de producción READY consultado el 15 de noviembre de 2026.

## 🗓️ Revisión documental

README revisado el **14 de noviembre de 2026**. El estado y las capacidades descritas se limitan a lo documentado en este repositorio; una función planificada no se considera implementada sin evidencia y validación.


> **Estado documental:** los dos gates de código están habilitados para pruebas controladas: `BUSINESS.acceptingOrders=true` y `ORDERS_ENABLED=true` en Wrangler. Esto no confirma que el Worker remoto esté actualizado: verificar `/health` (`ordersEnabled: true`) después del despliegue de pruebas. No procesar pedidos de clientes reales ni asumir que producción está validada. La configuración local debe revisarse en `app/worker/.dev.vars`; nunca versionar secretos.

## 🎯 Producto
Sandwichies administra el ciclo comercial de sándwiches: catálogo, recetas, precios, carrito, pedidos, pagos, entrega y operación administrativa. La experiencia cliente es mobile-first; la administración funciona en móvil y escritorio.

## ✨ Capacidades y base técnica
### Cliente
- Catálogo, búsqueda, filtros y recetas.
- Carrito persistente por UID con sincronización, control de conflictos y reconciliación idempotente tras timeouts.
- Recogida/domicilio, datos de contacto y ubicación/punto de encuentro.
- Firebase Email/Password Auth con verificación de correo; identidad administrativa separada.
- Historial privado de pedidos por UID, detalle recuperable y seguimiento logístico tras cerrar sesión o cambiar de navegador.
- Perfil persistente y direcciones guardadas, aislados por UID de Firebase.
### Administración
- Firebase Auth con custom claim `admin: true`.
- Gestión de pedidos, pagos, inventario operativo, compras y ajustes.
- Zonas poligonales editables, mapa, mesas virtuales, miembros y estados logísticos.
### Backend
- Dominio compartido de catálogo, recetas, precios, promociones y consumo en `app/shared/`.
- React 19, Vite 8, Firebase 12, Cloudflare Worker/Wrangler, Firestore REST, Firebase ID token/JWK, Leaflet/React-Leaflet y Node Test Runner.
- El Worker verifica tokens, valida CORS, reconstruye precios/consumos en servidor y conserva la API de pedidos; la creación de nuevas órdenes está desactivada por configuración.
- Cupboard es la autoridad de balances comerciales; Sandwichies mantiene referencias/sincronización operativa, no una segunda autoridad de stock.

## 🔎 Quality checkpoint — 2026-11-12

Local verification on 2026-11-12 passed `npm run check`: lint, 87 Worker tests, 43 domain tests, 12 Firestore Rules tests, 7 Functions/Firestore integration tests, build, bundle budget and smoke. Six moderate production dependency advisories remain; order intake remains disabled. See `app/docs/FINALIZATION-AUDIT.md` and `app/docs/INTEGRATION-MATRIX.md`.

## 📊 Estado del proyecto
**Fases históricas del repositorio:** Fase 1 (integridad de dominio) y Fase 2 (endurecimiento de seguridad) aparecen implementadas en el roadmap. Fases de calidad, integración y release conservan gates pendientes.

**Avance funcional verificado: 67.5%.** The score follows the weighted evidence rubric in `app/docs/FINALIZATION-AUDIT.md`. Checkout remains intentionally blocked; live integrations and authorized admin workflows are not fully verified.


| Área | Estado |
|---|---|
| Catálogo, recetas y precios confiables | Implementado en dominio compartido |
| Storefront y carrito | Authenticated cart persisted through local Worker/Firestore emulator and survived browser reload; discovery and category search verified |
| Pedidos y Worker | Gates habilitados en el código para pruebas controladas; runtime remoto pendiente de verificación |
| Zonas y mesas virtuales | Implementación y prueba local confirmadas; ampliar reglas |
| Cupboard | Puente idempotente en código; configuración/QA cruzado pendiente |
| Registro, perfil y direcciones persistentes | Synthetic verified Auth Emulator account and customer profile read/write verified locally; production unverified |
| DayFlow / Financial-D3v | Contratos futuros; no declarar integración operativa |
| Producción | No validada; sin autorización de despliegue |

## 🧭 Evolución de producto
1. Integridad de dominio: catálogo, recetas, precios y reconstrucción confiable de pedidos.
2. Seguridad: Firebase Auth, roles, Firestore Rules y backend privilegiado.
3. Calidad/CI, pruebas de navegador y validación de flujos críticos.
4. Integración Sandwichies ↔ Cupboard: consumo al confirmar, idempotencia, reversión y recuperación de saga.
5. Evolución de entrega: zonas, asignación por proximidad, horarios por zona y mesas virtuales.
6. Identidad de cliente: registro, perfil, direcciones geolocalizadas, carrito persistente, historial y checkout.
7. Integraciones de ecosistema: eventos de inventario a DayFlow y datos comerciales no sensibles hacia Financial-D3v, respetando su límite de privacidad.

## 🔒 Seguridad y límite de release
- El navegador no es confiable: nunca aceptar precios, costos, totales, utilidades, consecutivos ni estados privilegiados del cliente.
- El Worker verifica Firebase ID tokens; rutas administrativas requieren claim de administrador.
- CORS usa allowlist exacta.
- Los secretos viven solo en `app/worker/.dev.vars` local o en el almacén de secretos del proveedor; nunca en Git ni variables Vite públicas.
- Las credenciales de servicio Sandwichies y Cupboard deben ser distintas. El acceso Firestore REST con service account omite Firestore Rules y las reglas IAM son de alcance de proyecto; revisar el riesgo antes de producción.
- El consumo Cupboard y la actualización del pedido son una saga entre proyectos, no una transacción distribuida. Reintentos, locks y movimientos deterministas deben recuperarse de forma comprobada.
- Mantener pruebas en emuladores. No ejecutar pedidos de prueba contra inventario real.
- La recepción de pedidos está habilitada en el código para pruebas controladas por autorización explícita del propietario. No procesar pedidos reales ni considerar aprobado el release; el despliegue y la validación integral siguen siendo gates separados.

## 🧪 Desarrollo local
Desde `app/`:

```powershell
npm install
npm run dev
npm run worker:dev
npm run emulator:local
npm run worker:test
npm test
npm run security:test
npm run integration:test
npm run lint
npm run build
npm run check
```

Los servicios se ejecutan en terminales separadas. El emulador Firestore usa loopback; no exponer el puerto 8080 a internet. Para teléfono se requieren túneles separados para frontend y Worker, con CORS configurado para el origen exacto del frontend. Verificar siempre si el Worker está usando emulador o credenciales remotas antes de crear/confirmar pedidos.

## 📚 Documentación clave
- `AGENT.md` — reglas de trabajo, QA y límites de seguridad.
- `CONTEXT.md` — estado de continuidad.
- `ROADMAP.md` — fases y release gates.
- `STEPBYSTEP.md` y `MASTERPROMPT.md` — flujo de trabajo y handoff.
- `app/README.md` — arquitectura de aplicación y stack.
- `app/worker/README.md` — API, lifecycle de pedidos, Cupboard bridge y seguridad.
- `app/docs/development/local-worker.md` — entorno local.
- `app/docs/product/virtual-tables/` — mesas virtuales y entrega.

## 🤝 Identidad
**Sandwichies · PALMI-D3V** — *Build · Create · Improve · Validate.*

Sandwichies es propietario del catálogo comercial, los precios, los pedidos y la logística. Cupboard es propietario de las existencias; no duplicar su autoridad.
