# 🥪 Sandwichies

**Producto digital de PALMI-D3V** · Plataforma de pedidos, experiencia gastronómica y operación del negocio.

Sandwichies evoluciona desde su experiencia web hacia un producto **mobile-first** para clientes y una consola operativa completa para administración. La web actual es la base funcional; las mesas virtuales y las aplicaciones nativas iOS/Android forman parte de la evolución planificada, no de las capacidades ya entregadas.

> **Estado actual:** desarrollo activo · integración con Cupboard en fase de cierre · pedidos reales deshabilitados.

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
- Flujo de envío de pedido preparado para pruebas controladas; no habilitado para pedidos reales.

### Administración
- Autenticación Firebase y autorización mediante custom claim de administrador.
- Consulta y gestión operativa de pedidos.
- Estados de pedido y de pago diferenciados.
- Visibilidad de inventario, compras, ajustes y señales operativas.
- Reglas de acceso restrictivas; el navegador no puede crear pedidos ni modificar datos financieros confiables.

### Backend e integración
- React 19, JavaScript, Vite 8 y Firebase.
- Cloud Functions para operaciones privilegiadas y reconstrucción confiable de pedidos.
- Firestore como almacenamiento operativo.
- Integración Sandwichies ↔ Cupboard con movimientos idempotentes, reservas y reversión según el flujo.
- Suite de pruebas de dominio, reglas de Firestore, integración, build, smoke y presupuesto de bundle.

Consulta [app/README.md](app/README.md) para el contexto técnico y los comandos de trabajo.

---

## 📊 Estado y avance del proyecto

<sub>Actualizado: 30 de octubre de 2026 · Porcentajes orientativos calculados sobre tareas y entregables documentados. No equivalen a porcentaje de código, disponibilidad en producción ni aprobación de release.</sub>

| Área | Avance estimado | Estado |
|---|---:|---|
| Dominio, catálogo, precios y contratos de pedido | **100%** | Base implementada |
| Seguridad y reglas de acceso | **100%** | Base implementada; requiere validación continua |
| Calidad automatizada local | **80%** | Gate disponible; ejecución CI reciente inconclusa |
| Experiencia de cliente web | **70%** | Base funcional; validación integral pendiente |
| Administración web | **85%** | Flujos principales construidos; revisión operativa pendiente |
| Integración con Cupboard (Fase 3) | **65%** | Implementación base; configuración real y pruebas cruzadas pendientes |
| Release de pedidos reales | **10%** | Bloqueado deliberadamente |
| Mesas virtuales | **100% diseño / 0% implementación** | Especificación y mockups preparados |
| Aplicaciones nativas iOS y Android | **0% implementación** | Ruta de crecimiento documentada |

**No se publica un porcentaje global único:** mezclar funcionalidades implementadas, pruebas pendientes, preparación de release y trabajo futuro produciría una métrica engañosa.

### Fase activa — Integración con Cupboard

Trabajo ya documentado/implementado:
- Adaptador seguro entre proyectos Firebase mediante Admin SDK.
- Reserva de ingredientes al confirmar un pedido.
- Idempotencia para evitar descuentos y reversiones duplicados.
- Reposición de existencias al cancelar pedidos confirmados.
- Separación entre consumo físico y criterio contable de venta completada.
- Sincronización de compras y ajustes desde Sandwichies.
- Preflight para detectar configuración incompleta.

Pendiente para cerrar la fase:
1. Reemplazar identificadores de ejemplo por el hogar real de Cupboard.
2. Completar y revisar el mapeo de ingredientes.
3. Ejecutar el preflight con variables reales.
4. Configurar los permisos de la identidad real de Cloud Functions en Cupboard.
5. Ejecutar pruebas cruzadas de confirmar, cancelar, falta de stock y reintentos.
6. Correr la suite completa en ambos proyectos y revisar los resultados.

### Calidad y CI

- El proyecto dispone de `npm run check` para auditar dependencias, ejecutar lint, pruebas, reglas, integración, build, presupuesto de bundle y smoke.
- La última validación local completa registrada y confirmada por el propietario corresponde al checkpoint del **22 de octubre de 2026**.
- La corrección de arranque de dependencias vendor se integró en `main` el 29 de octubre.
- Los workflows recientes de GitHub Actions aparecen como fallidos sin pasos ejecutados ni logs de trabajo útiles. Esto no demuestra un fallo del código, pero tampoco permite declarar CI aprobado.
- El estado Vercel consultado para el commit documental más reciente fue exitoso; esto no sustituye pruebas funcionales ni aprobación de release.

Antes de considerar la calidad actual validada, hay que ejecutar de nuevo `npm run check` desde el entorno actualizado y recuperar una ejecución CI con runner y pasos verificables.

---

## 🧭 Evolución de producto

### Web actual y experiencia mobile-first
1. Cerrar la integración con Cupboard.
2. Completar pruebas del recorrido de cliente en móvil y escritorio.
3. Validar checkout cerrado, errores, estados vacíos, accesibilidad y navegación.
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

**Pendiente antes del backend:** decidir qué eventos reinician el temporizador y cómo se gestionan operativamente las mesas vencidas con pedidos pendientes. Los mockups son referencia visual, no evidencia de implementación.

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

- `BUSINESS.acceptingOrders = false` permanece como barrera de seguridad.
- No se deben recibir pedidos reales ni habilitar checkout en producción.
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
