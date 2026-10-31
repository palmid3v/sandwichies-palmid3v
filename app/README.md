# Sandwichies — Contexto técnico de la aplicación

**Actualizado:** 30 de octubre de 2026  
**Rama principal:** `main`  
**Estado:** desarrollo activo y pruebas controladas; no listo para recibir pedidos reales.  
**Fase de integración prioritaria:** Sandwichies ↔ Cupboard (Fase 3).

> Fuente de verdad: código y configuración actuales del repositorio. Las especificaciones, mockups y roadmaps describen objetivos; no prueban que una función esté implementada.

## 1. Propósito y superficies del producto

Sandwichies es una aplicación para descubrir y configurar sándwiches, gestionar el carrito y preparar pedidos, junto con herramientas administrativas para operar pedidos, pagos e inventario.

La prioridad de UX es:
1. Cliente mobile-first.
2. Operación administrativa mobile.
3. Administración desktop para gestión integral del negocio.
4. Preparación progresiva para aplicaciones iOS y Android.

La web actual usa React y Vite. No existe todavía una aplicación nativa iOS/Android implementada en este repositorio.

## 2. Capacidades presentes en el código

### Cliente
- Catálogo y descubrimiento de recetas existentes.
- Búsqueda y filtros del catálogo.
- Carrito con cantidades, eliminación y cálculo de totales.
- Selección de recogida o domicilio y captura de datos de contacto.
- Sesión de cliente mediante Firebase Anonymous Auth, separada del cliente Firebase administrativo.
- Validación de solicitudes y reconstrucción confiable de pedidos en backend.
- El flujo de envío existe para pruebas controladas, pero los pedidos reales permanecen deshabilitados.

### Administración
- Firebase Authentication y custom claim `admin: true`.
- Lectura y operación administrativa de pedidos.
- Estados de pedido y de pago diferenciados.
- Consulta y gestión de inventario, compras y ajustes.
- Acciones privilegiadas protegidas por backend y reglas de Firestore.

### Backend e inventario
- `createOrder`: callable para validar y reconstruir la solicitud con valores confiables del servidor.
- `transitionOrderStatus`: transición de estados a través del backend autorizado.
- Funciones de inventario con operaciones idempotentes.
- Integración con Cupboard para reservas, movimientos y reversiones de inventario.
- La sincronización de consumo físico y el criterio contable de venta completada permanecen separados.

## 3. Arquitectura

- `src/`: interfaz React/Vite, rutas, páginas y componentes.
- `shared/`: catálogo, precios, negocio, recetas, pedidos e inventario compartidos.
- `functions/index.js`: Cloud Functions y operaciones confiables.
- `firestore.rules`: permisos de lectura y escritura.
- `test/`: pruebas unitarias y de seguridad.
- `scripts/`: validaciones, smoke, integración y utilidades de operación.
- `docs/`: decisiones, auditorías, producto y documentación técnica.

Flujo arquitectónico esperado:

```
Cliente / Administración
        ↓
Adaptadores de interfaz
        ↓
Dominio compartido (shared/)
        ↓
Cloud Functions autorizadas
        ↓
Firestore / integración Cupboard
```

El navegador es un entorno no confiable. No aceptar desde el cliente precios, totales, costos, utilidad, consecutivos ni estados privilegiados como fuente de verdad.

## 4. Estado de avance

Los porcentajes son estimaciones de avance documental/funcional por área, no métricas de líneas de código ni de release.

| Área | Avance estimado | Observación |
|---|---:|---|
| Dominio, catálogo, precios y contratos de pedido | 100% | Base centralizada y pruebas existentes |
| Seguridad y reglas de acceso | 100% | Base implementada; mantener regresiones |
| Calidad automatizada local | 80% | Scripts disponibles; falta repetir el gate sobre el estado actual |
| UX cliente web | 70% | Flujos base; validación completa pendiente |
| UX administración | 85% | Herramientas principales; validación operativa pendiente |
| Integración con Cupboard | 65% | Falta configuración real y pruebas cruzadas |
| Release de pedidos reales | 10% | No autorizado ni listo |
| Mesas virtuales | Implementación base | Cliente, funciones, consola admin y reglas; validación/release pendientes |
| iOS y Android nativos | 0% código | Plan de crecimiento, sin app nativa |

No se calcula un promedio general porque las áreas tienen pesos y criterios de finalización distintos.

## 5. Fase activa: cerrar la integración con Cupboard

### Implementado/documentado
- Adaptador entre proyectos Firebase con Admin SDK.
- Reserva de existencias al confirmar un pedido.
- IDs deterministas para idempotencia.
- Protección ante reutilización conflictiva de claves idempotentes.
- Reversión de existencias al cancelar después de confirmar.
- Sincronización de compras y ajustes manuales desde Sandwichies.
- Preflight de configuración y mapeo.

### Pendiente
1. Configurar el ID real del hogar de Cupboard.
2. Completar y validar el mapeo de ingredientes.
3. Ejecutar `npm run cupboard:preflight` con variables reales.
4. Conceder a la identidad real de Functions los permisos mínimos necesarios en Cupboard.
5. Probar confirmar, cancelar, falta de stock, reintentos y duplicados en emuladores/entorno controlado.
6. Ejecutar la suite de ambos proyectos y revisar los movimientos resultantes.

No ejecutar importaciones ni sincronizaciones contra datos reales sin revisar primero el modo dry-run, las variables y el destino.

## 6. Mesas virtuales — implementación base

La referencia vigente está en `docs/product/virtual-tables/`.

Reglas definidas:
- Asignación automática por backend; el cliente no elige mesa.
- Agrupación dentro de 50 m desde el punto ancla de la mesa.
- Máximo 9 pedidos activos por mesa.
- Cada pedido conserva su identidad, cliente, artículos, pago y estados.
- Zonas de servicio mediante polígonos administrables.
- Inactividad inicial de 60 minutos, configurable.
- El cliente solo puede consultar su propio pedido.
- El administrador puede operar desde móvil y desktop.
- No alterar pagos ni duplicar movimientos de inventario por agrupar pedidos.

El backend, las reglas Firestore y la consola admin están implementados. Pedido nuevo, llegada del cliente y cambios logísticos admin reinician los 60 minutos. Al vencer, una mesa deja de aceptar pedidos y conserva pedidos activos e historial para coordinación individual. Validar configuración, operación y diseño en proyecto no productivo antes de release.

Los enlaces de Canva son referencias de diseño. Los archivos binarios exportados de los mockups aún no están archivados dentro del repositorio.

## 7. Crecimiento hacia iOS y Android

La ruta propuesta es incremental:

1. **Preparación mobile-first:** terminar y validar UX web móvil, estados, accesibilidad y navegación.
2. **Separación de dominio y backend:** asegurar contratos estables para catálogo, precios, autenticación, pedidos, seguimiento y operaciones.
3. **ADR tecnológico:** comparar React Native/Expo, PWA y alternativas según capacidades nativas, costos, mantenimiento y experiencia.
4. **Android MVP:** catálogo, carrito, identidad/sesión, pedido y seguimiento; distribución interna y pruebas en dispositivos.
5. **iOS MVP:** paridad funcional adaptada a iPhone, pruebas en dispositivos y distribución interna.
6. **Publicación y evolución:** notificaciones, enlaces profundos, analítica, privacidad, observabilidad, soporte y releases.

No migrar el frontend actual ni duplicar reglas de negocio antes de una decisión arquitectónica documentada. Las aplicaciones móviles deben consumir el backend confiable; nunca deben convertirse en autoridad de precios, pagos o inventario.

## 8. Firebase, seguridad y release

- El propietario confirmó que debe conservarse su cambio local `BUSINESS.acceptingOrders = true`; ese archivo es un cambio suyo y se excluye de este commit.
- La bandera local no es aprobación de release ni despliegue. La configuración de Cupboard y los gates de release permanecen independientes.
- La autenticación administrativa usa Firebase Auth y custom claim `admin: true`.
- El cliente usa una instancia Firebase separada para sesiones anónimas.
- Firestore Rules deben continuar restrictivas y negar cualquier operación no declarada.
- Las escrituras privilegiadas deben pasar por Cloud Functions con validación y autorización.
- No desplegar Functions/Rules, activar facturación ni procesar pedidos reales sin autorización explícita.
- No cambiar proveedores, métodos, comisiones o políticas de pago; Tap to Pay está fuera de alcance.

La configuración local del proyecto Firebase se define en `.firebaserc`. Verificar el proyecto destino antes de ejecutar cualquier comando Firebase. Priorizar emuladores y proyectos demo para pruebas.

## 9. Calidad y verificación

Scripts definidos en `package.json`:

| Comando | Propósito |
|---|---|
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias de dominio |
| `npm run security:test` | Reglas Firestore en Emulator Suite |
| `npm run integration:test` | Integración Functions/Firestore e inventario |
| `npm run build` | Build de Vite |
| `npm run performance:check` | Presupuesto de bundle |
| `npm run smoke` | Smoke de entrada |
| `npm run check` | Gate combinado |
| `npm run release:verify` | Verificaciones previas de release |
| `npm run cupboard:preflight` | Revisión de configuración de integración |
| `npm run cupboard:catalog-sync` | Sincronización del catálogo compartido |

Desde esta carpeta:

```bash
npm install
npm run dev
npm run check
```

Para pruebas de reglas, se requiere Java disponible en `PATH`. Usa exclusivamente el proyecto demo/emuladores durante pruebas automatizadas.

### Evidencia de calidad conocida
- El propietario confirmó una ejecución local completa del gate el **22 de octubre de 2026**.
- La corrección de orden de ejecución de dependencias vendor se integró en `main` el **29 de octubre de 2026**.
- La suite completa no se ha vuelto a confirmar después de todos los cambios posteriores.
- Los workflows recientes de GitHub Actions reportan fallo sin pasos ejecutados; la causa no queda demostrada por esa evidencia. No marcar CI como aprobado.
- El estado Vercel del commit documental más reciente consultado fue exitoso; no demuestra el funcionamiento de checkout ni la disponibilidad de Functions.

## 10. Orden recomendado de trabajo

1. Cerrar la configuración y las pruebas cruzadas de Cupboard.
2. Ejecutar `npm run check` en el estado actual y recuperar CI verificable.
3. Auditar el flujo cliente completo en mobile y desktop; no desplegar ni procesar pedidos reales.
4. Validar la operación administrativa, permisos, inventario y recuperación de errores.
5. Validar visual y operativamente las mesas virtuales implementadas en entorno no productivo.
6. Preparar contratos de dominio/API y un ADR para la estrategia iOS/Android.
7. Ejecutar release verification y solicitar autorización separada antes de cualquier lanzamiento.

---

**Regla permanente:** implementación, pruebas, despliegue y lanzamiento son etapas distintas. Ninguna documentación o mockup habilita por sí sola pedidos reales.
