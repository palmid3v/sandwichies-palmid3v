# Sandwichies

**Sandwichies** es una plataforma web para la operación de un negocio gastronómico. Reúne la experiencia de compra del cliente con las herramientas administrativas necesarias para gestionar catálogo, pedidos, pagos, entregas e inventario operativo.

El producto prioriza una experiencia mobile-first para clientes y operación móvil, con una consola administrativa utilizable también desde escritorio.

## Producto

Sandwichies cubre el ciclo comercial desde el descubrimiento del catálogo hasta la preparación y seguimiento de pedidos.

- **Experiencia de cliente:** catálogo de sándwiches y recetas, búsqueda, filtros, personalización, carrito persistente asociado a la cuenta, perfil y direcciones guardadas.
- **Pedidos:** selección de recogida o domicilio, captura de datos de entrega, consulta del historial y seguimiento del estado.
- **Administración:** gestión de pedidos y pagos, compras, ajustes y operaciones relacionadas con inventario, zonas de entrega y mesas virtuales.
- **Dominio comercial:** catálogo, recetas, precios, promociones y reconstrucción confiable de pedidos en lógica compartida y backend.
- **Integración de inventario:** solicita movimientos a Cupboard; Cupboard conserva la autoridad sobre cantidades y movimientos de existencias.

## Arquitectura y tecnologías

La aplicación web está construida con **React 19**, **Vite 8** y JavaScript ES modules. La interfaz utiliza React Router y CSS propio. Los servicios de identidad y datos se apoyan en Firebase Authentication y Cloud Firestore.

El repositorio incluye un backend API en **Cloudflare Workers**, con acceso REST a Firestore, validación de Firebase ID tokens, control de CORS y operaciones comerciales idempotentes. La integración con Cupboard utiliza identidades de servicio separadas y movimientos deterministas.

También incluye Leaflet/React-Leaflet para mapas, herramientas de pruebas con Node.js, Firebase Emulator Suite, ESLint y scripts de validación.

La aplicación nativa para iOS o Android no forma parte de este repositorio; la superficie cliente actual es web/PWA.

## Estado operativo

La implementación del producto y la disponibilidad de sus servicios remotos son asuntos distintos. La configuración de recepción de pedidos y los endpoints backend deben verificarse en el entorno correspondiente antes de considerar habilitado el flujo comercial. La presencia de código o de un deployment web no demuestra que Worker, credenciales, permisos cruzados o integraciones estén operativos.

No se debe tratar el entorno de pruebas como autorización para procesar pedidos reales. Los despliegues, cambios de configuración y operaciones sobre inventario real requieren validación y autorización independientes.

## Desarrollo

La aplicación se encuentra en `app/`. Instala dependencias desde esa carpeta y utiliza los scripts definidos en `app/package.json` para desarrollo, pruebas, lint y build. Los servicios emulados deben utilizarse para pruebas que involucren Firestore y operaciones de pedidos.

Consulta primero `app/README.md` y `app/worker/README.md` para conocer la arquitectura y los límites del backend. Nunca incluyas secretos o credenciales de servicio en el repositorio ni en variables públicas del frontend.

## Documentación

- [Contexto técnico de la aplicación](app/README.md)
- [API Worker](app/worker/README.md)
- [Auditoría de finalización](app/docs/FINALIZATION-AUDIT.md)
- [Matriz de integración](app/docs/INTEGRATION-MATRIX.md)
- [Roadmap](ROADMAP.md)
- [Guía de trabajo para agentes](AGENT.md)

## Repositorio y despliegue

- Repositorio: [palmid3v/sandwichies-palmid3v](https://github.com/palmid3v/sandwichies-palmid3v)
- Sitio web: [sanpalmid3v.vercel.app](https://sanpalmid3v.vercel.app)

El enlace web identifica el sitio del proyecto; su disponibilidad no certifica la operación de los servicios backend ni habilita automáticamente la recepción de pedidos.

---

**Sandwichies · PALMI-D3V**  
*Build · Create · Improve · Validate.*
