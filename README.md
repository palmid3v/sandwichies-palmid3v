# 🥪 𝐒𝐚𝐧𝐝𝐰𝐢𝐜𝐡𝐢𝐞𝐬 — Pedidos y operación gastronómica

> **PALMI-D3V** · Storefront mobile-first y consola de operación del negocio.

> **Estado documental:** la recepción de pedidos está desactivada. `BUSINESS.acceptingOrders=false` en el dominio compartido y `ORDERS_ENABLED=false` en Wrangler. El storefront debe mostrar **Pedidos cerrados** y el Worker debe rechazar nuevas órdenes. La configuración local debe revisarse en `app/worker/.dev.vars`; nunca versionar secretos.

## 🎯 Producto
Sandwichies administra el ciclo comercial de sándwiches: catálogo, recetas, precios, carrito, pedidos, pagos, entrega y operación administrativa. La experiencia cliente es mobile-first; la administración funciona en móvil y escritorio.

## ✨ Capacidades y base técnica
### Cliente
- Catálogo, búsqueda, filtros, recetas, cantidades y carrito.
- Recogida/domicilio, datos de contacto y ubicación/punto de encuentro.
- Firebase Anonymous Auth para sesiones de cliente; identidad administrativa separada.
- Consulta privada del pedido y seguimiento logístico.
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

## 📊 Estado del proyecto
**Fases históricas del repositorio:** Fase 1 (integridad de dominio) y Fase 2 (endurecimiento de seguridad) aparecen implementadas en el roadmap. Fases de calidad, integración y release conservan gates pendientes.

**Avance estimado del MVP funcional: 70%.** Hay evidencia de pruebas automatizadas y pruebas manuales locales del flujo de zona/pedido/mesa; faltan pruebas integrales repetibles, configuración de producción, revisión IAM, recuperación de fallos entre proyectos, identidad persistente de clientes y aceptación de release.

| Área | Estado |
|---|---|
| Catálogo, recetas y precios confiables | Implementado en dominio compartido |
| Storefront y carrito | Implementado; persistencia de cuenta por completar |
| Pedidos y Worker | Recepción desactivada; `BUSINESS.acceptingOrders=false` y `ORDERS_ENABLED=false` |
| Zonas y mesas virtuales | Implementación y prueba local confirmadas; ampliar reglas |
| Cupboard | Puente idempotente en código; configuración/QA cruzado pendiente |
| Registro, perfil y direcciones persistentes | Perfil y direcciones implementados en código; QA local pendiente |
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
- La recepción de pedidos permanece desactivada. No habilitar pedidos ni desplegar cambios de backend sin aprobación explícita y release checklist aprobado.

## 🧪 Desarrollo local
Desde `app/`:

```powershell
npm install
npm run dev
npm run worker:dev
npm run emulator:firestore
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
