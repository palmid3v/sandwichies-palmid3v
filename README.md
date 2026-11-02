# 🥪 Sandwichies

**Producto digital de PALMI-D3V** · Plataforma de pedidos, experiencia gastronómica y operación del negocio.

Sandwichies evoluciona desde su experiencia web hacia un producto **mobile-first** para clientes y una consola operativa completa para administración. La web ofrece una primera implementación local de puntos de encuentro y mesas virtuales; su validación operativa y eventual release siguen pendientes.

> **Estado actual (31 de octubre de 2026):** desarrollo activo · mesas virtuales con implementación base en el código · integración Cupboard y release pendientes · backend Functions sin despliegue en Firebase. El commit `270303d` de `main` deja `BUSINESS.acceptingOrders = true`, en conflicto con el gate de release documentado; no se ha verificado ni autorizado producción.

---

## 🎯 Producto

Sandwichies reúne tres superficies conectadas:

| Superficie | Objetivo | Prioridad |
|---|---|---:|
| Cliente web/mobile | Descubrir el menú, configurar productos, carrito y experiencia de pedido | Máxima |
| Administración mobile | Consultar pedidos, operar entregas y resolver tareas desde campo | Alta |
| Administración desktop | Gestionar pedidos, catálogo, cuentas, costos, inventario y operación | Alta |

La experiencia de cliente debe diseñarse primero para pantallas móviles. La experiencia administrativa debe funcionar bien tanto en móvil como en escritorio, sin sacrificar la densidad de información que requiere la gestión del negocio.

## ✨ Capacidades y base técnica

### Cliente
- Catálogo de recetas y productos existentes.
- Búsqueda y descubrimiento de productos.
- Configuración, carrito, cantidades y cálculo de totales.
- Captura de datos de contacto y selección de recogida o domicilio.
- Sesión de cliente con Firebase Anonymous Auth, separada de la autenticación administrativa.
- Validaciones compartidas para precios, productos y solicitudes de pedido.
- Captura GPS o manual de puntos de encuentro, validación de polígonos y asignación automática a mesa virtual.
- Seguimiento privado del pedido y acción “Ya estoy aquí”. El checkout sigue sujeto a los controles de release y Cupboard.

### Administración
- Autenticación Firebase y autorización mediante custom claim de administrador.
- Consulta y gestión operativa de pedidos.
- Estados de pedido y de pago diferenciados.
- Visibilidad de inventario, compras, ajustes y señales operativas.
- Consola de mesas virtuales con mapa, zonas, cola de pedidos y cambios logísticos individuales.
- Reglas de acceso restrictivas; el navegador no puede crear pedidos ni modificar datos financieros confiables.

### Backend e integración
- React 19, JavaScript ES modules y Vite 8 (con configuración de build/Rolldown).
- Firebase Authentication y Cloud Firestore; sesiones de cliente anónimas aisladas de la autenticación administrativa.
- Código backend en Firebase Cloud Functions v2 + Firebase Admin SDK para operaciones privilegiadas, pedidos, mesas virtuales y sincronización con Cupboard. **La implementación existe en el repositorio, pero no está desplegada en `sandwich-pro`**: la consulta del proyecto devolvió cero funciones y los endpoints actuales responden 404.
- Leaflet + React-Leaflet para mapas; OpenStreetMap como fuente de mapas prevista.
- Vercel para despliegue web observado; Firebase CLI y Emulator Suite para configuración y pruebas locales.
- Node.js, npm, ESLint, Node Test Runner, Firebase Rules Unit Testing y scripts propios para pruebas, seguridad, integración, build, smoke y presupuesto de bundle.
- Cloudflare Workers Free está en evaluación como posible backend alternativo compatible con el presupuesto $0; **no está integrado ni desplegado**.

Consulta [app/README.md](app/README.md) para el contexto técnico y los comandos de trabajo.

**Restricción económica vigente:** presupuesto objetivo $0. El proyecto Firebase permanece en Spark; no vincular facturación ni activar Blaze. La arquitectura de backend de producción debe resolverse antes de habilitar pedidos reales. Ver [stack y herramientas](app/README.md#4-stack-tecnológico-y-herramientas).

---

## 📊 Estado del proyecto

| Área | Estado verificado |
|---|---|
| Catálogo, recetas, precios y pedido confiable | Implementados; reglas canónicas en `app/shared/` |
| Cliente web | Descubrimiento, filtros, carrito y checkout implementados; mejoras mobile recientes en validación local |
| Administración web | Pedidos, resumen, inventario y operaciones de mesas; acceso requiere custom claim `admin: true` |
| Mesas virtuales | Implementación base en cliente, Cloud Functions, Firestore Rules y consola admin; falta validación operativa externa |
| Sandwichies ↔ Cupboard | Integración implementada; configuración real y pruebas cruzadas pendientes |
| Aplicaciones iOS/Android | No implementadas; plan documentado |
| Release | No aprobado. No hay evidencia de despliegue de esta versión |

### Fase activa — Integración con Cupboard

Trabajo ya documentado/implementado:
- Adaptador seguro entre proyectos Firebase mediante Admin SDK.
- Reserva de ingredientes al confirmar un pedido.
- Idempotencia para evitar descuentos y reversiones duplicados.
- Reposición de existencias al cancelar pedidos confirmados.
- Separación entre consumo físico y criterio contable de venta completada.
- Sincronización de compras y ajustes desde Sandwichies.
- Preflight para detectar configuración incompleta.
- Catálogo centralizado de 44 productos en Cupboard: los 11 ingredientes de recetas conservan sus IDs semánticos en Sandwichies y se asocian a productos Negocio con IDs `N-#######`; los otros 33 productos exportados se asignan a Hogar con IDs `HD-#######`. El código de barras queda como atributo, no como identidad.
- El mapeo canónico de los 11 ingredientes está versionado en `app/shared/catalog.js`; `CUPBOARD_INGREDIENT_MAP_JSON` queda como override opcional.

Pendiente para cerrar la fase:
1. Reemplazar identificadores de ejemplo por el hogar real de Cupboard.
2. Aplicar la migración de identidad desde Cupboard y desplegar manualmente las Firestore Rules actualizadas.
3. Ejecutar el preflight con variables reales.
4. Configurar los permisos de la identidad real de Cloud Functions en Cupboard.
5. Ejecutar pruebas cruzadas de confirmar, cancelar, falta de stock y reintentos.
6. Correr la suite completa en ambos proyectos y revisar los resultados.

### Calidad y CI

- El proyecto dispone de `npm run check` para auditar dependencias, ejecutar lint, pruebas, reglas, integración, build, presupuesto de bundle y smoke.
- **Validación local (30 de octubre de 2026):** `npm run check` pasó lint, 40 pruebas unitarias, 9 pruebas de reglas, 7 pruebas de integración, build, presupuesto de bundle y smoke (`/` y `/admin`). La auditoría no encontró vulnerabilidades altas/críticas, pero reportó 6 moderadas transitivas (`glob`, `minimatch`). El emulador informó que `expireVirtualTables` no se ejecutó porque Pub/Sub Emulator no estaba iniciado.
- **Revisión visual local:** storefront revisado en móvil y escritorio; se verificaron búsqueda, filtros, composición de recetas, dock del carrito y navegación al resumen. No se envió ningún pedido. `/admin` mostró el acceso; no se inició sesión, por lo que el dashboard autenticado requiere revisión posterior.
- La corrección de arranque de dependencias vendor se integró en `main` el 29 de octubre.
- Los workflows recientes de GitHub Actions aparecen como fallidos sin pasos ejecutados ni logs de trabajo útiles. Esto no demuestra un fallo del código, pero tampoco permite declarar CI aprobado.
- El estado Vercel consultado para el commit documental más reciente fue exitoso; esto no sustituye pruebas funcionales ni aprobación de release.

La ejecución local no sustituye CI ni validación visual del propietario. CI no se verificó para estos cambios locales.

---

## 🧭 Evolución de producto

### Web actual y experiencia mobile-first
1. Cerrar la integración con Cupboard.
2. Completar pruebas del recorrido de cliente en móvil y escritorio.
3. Validar errores, estados vacíos, accesibilidad y navegación. Resolver el conflicto actual del gate `acceptingOrders` antes de push o despliegue.
4. Consolidar la experiencia administrativa para operación diaria, cuentas e inventario.
5. Medir rendimiento y corregir los puntos críticos del recorrido móvil.

### Mesas virtuales y puntos de encuentro

La especificación vigente está en [app/docs/product/virtual-tables/](app/docs/product/virtual-tables/).

Reglas de producto definidas:
- El backend asigna la mesa; el cliente no la elige.
- Agrupación por proximidad de 50 metros desde el ancla de la mesa.
- Máximo 9 pedidos activos por mesa.
- Cada pedido conserva cliente, productos, pago y estados independientes.
- Zonas de servicio definidas por polígonos administrados por el negocio.
- Inactividad inicial de 60 minutos, configurable.
- El cliente solo consulta su pedido; no ve datos privados de otros clientes.
- El administrador opera desde móvil y desktop.
- Pagos y movimientos de inventario de Cupboard no se alteran por agrupar pedidos.

**Implementación base:** las zonas son polígonos administrados; el backend compara cada pedido con el ancla a 50 m y limita cada mesa a 9 pedidos activos. Pedido nuevo, llegada del cliente y cambio logístico del admin reinician los 60 minutos. Al vencer, la mesa deja de aceptar pedidos y los pendientes e historial permanecen visibles para coordinación individual. No se cancelan pedidos al expirar.

**Pendiente:** validación visual/operativa por el propietario, configuración real de zonas, pruebas en proyecto no productivo y gate completo. No desplegar ni abrir pedidos reales con este cambio.

### Crecimiento hacia aplicaciones iOS y Android

La estrategia es evolucionar por etapas, reutilizando el dominio y los servicios confiables antes de decidir una migración de interfaz.

| Etapa | Entregable | Criterio para avanzar |
|---|---|---|
| 0. Preparación mobile-first | UX web móvil, flujos, componentes, accesibilidad y diseño adaptativo | Recorrido web móvil validado |
| 1. Separación de dominio | Contratos API, validaciones compartidas, autenticación, pedidos y permisos independientes de la UI | Backend estable y probado |
| 2. Decisión tecnológica | ADR comparando React Native/Expo, PWA y alternativas según capacidades nativas, mantenimiento y costos | Decisión documentada y aprobada |
| 3. Android MVP | Catálogo, carrito, cuenta/sesión, pedido y seguimiento | Pruebas en dispositivos Android y distribución interna |
| 4. iOS MVP | Paridad funcional del cliente y experiencia adaptada a iPhone | Pruebas en dispositivos iOS y distribución interna |
| 5. Operación y crecimiento | Notificaciones, enlaces profundos, analítica, accesibilidad, publicación y soporte | Seguridad, privacidad, observabilidad y release aprobados |

**Principios para iOS y Android**
- No duplicar reglas de precios, recetas, pedidos, pagos o inventario en las aplicaciones.
- Mantener las operaciones privilegiadas en backend.
- Reutilizar contratos y servicios; compartir UI solo cuando aporte valor real.
- No introducir dependencias de plataforma antes de aprobar la arquitectura.
- Diseñar desde ahora pensando en tamaños de pantalla, conectividad intermitente, permisos, navegación, notificaciones y accesibilidad.
- Las apps nativas no deben habilitar pedidos reales ni cambiar pagos por su cuenta.

---

## 🔒 Seguridad y límite de release

- El commit `270303d` de `main` establece `BUSINESS.acceptingOrders = true`, a petición previa del propietario. Esto contradice el gate de release; no es autorización de despliegue ni prueba del estado de producción. Resolverlo antes de publicar una versión que habilite pedidos.
- No se deben recibir pedidos reales ni habilitar checkout en producción.
- El estado en `main` de `acceptingOrders` contradice esta regla: `true` en `270303d`. No se ha verificado la producción; detener una publicación que habilite pedidos hasta resolver el gate.
- No desplegar Functions o Firestore Rules, activar facturación ni modificar credenciales sin autorización explícita.
- No cambiar proveedores, métodos, comisiones o políticas de pago como parte de tareas de UX.
- No introducir Tap to Pay.
- Mantener el aislamiento entre clientes y administración.
- Mantener la integración de inventario con Cupboard idempotente y auditable.
- Nunca relajar reglas de Firestore para hacer pasar una prueba.

El cierre de una tarea técnica no equivale a autorización de lanzamiento.

## 🧪 Desarrollo local

Desde `app/`:

```bash
npm install
npm run dev
npm run lint
npm test
npm run security:test
npm run integration:test
npm run build
npm run performance:check
npm run smoke
npm run check
```

Consulta [app/README.md](app/README.md) para prerequisitos, emuladores y descripción de los scripts.

## 📚 Documentación clave

- [Contexto técnico de la aplicación](app/README.md)
- [Masterprompt del repositorio](MASTERPROMPT.md)
- [Roadmap](ROADMAP.md)
- [Documentación técnica](app/docs/README.md)
- [Mesas virtuales: especificación y dirección UX](app/docs/product/virtual-tables/README.md)
- [Prompt maestro de implementación UX](app/docs/product/virtual-tables/PROMPT-MAESTRO.md)
- [Flujos y reglas de mesas virtuales](app/docs/product/virtual-tables/FLUJO-Y-REGLAS.md)
- [Mockups y referencias visuales](app/docs/product/virtual-tables/mockups/README.md)

## 🤝 Identidad

Diseñado y desarrollado bajo **PALMI-D3V**.

*Build · Create · Improve · Validate*


## Local Worker development — 2026-11-02

The existing Cloudflare Worker now has a local development path for delivery zones and virtual-table operations using Wrangler and the Firestore Emulator. The admin delivery console reads its operational data through protected Worker endpoints rather than direct browser subscriptions to those collections.

- Worker: `127.0.0.1:8787`
- Firestore Emulator: `127.0.0.1:8080`
- Vite frontend: `127.0.0.1:5182`
- Orders remain disabled; no Cloudflare deployment, billing change, or production Firestore write is part of local setup.

See [Local Worker development](app/docs/development/local-worker.md) for the exact PowerShell workflow and the later Cloudflare completion checklist.
