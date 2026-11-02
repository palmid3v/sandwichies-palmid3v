# Integración Sandwichies ↔ Cupboard

## Estado

El backend de Sandwichies se conecta al espacio comercial `Negocio · Sandwichies` de Cupboard. Sandwichies conserva la lógica confiable de recetas y calcula el consumo; Cupboard es la fuente operativa de existencias. El panel administrativo cambia el estado de un pedido mediante la callable `transitionOrderStatus`. Las compras y ajustes iniciados en el panel de Sandwichies también se aplican en Cupboard mediante un ID idempotente; si la conexión no está configurada, el backend rechaza el movimiento sin crear un saldo local ficticio.

Al confirmar, todos los ingredientes se descuentan en una transacción de Firestore en el proyecto Cupboard. Si algún producto no existe, falta un mapeo o no hay suficiente stock, se rechaza la confirmación sin cambios parciales ni avance del estado del pedido. Si se cancela un pedido ya confirmado y aún no entregado, se restaura la cantidad exacta con una reversión idempotente. Cancelar un pedido pendiente no genera movimientos.

Cada movimiento remoto utiliza un ID determinista por pedido, ingrediente y operación. Los reintentos no descuentan ni reponen dos veces. Sandwichies guarda una réplica de saldos y movimientos para su vista administrativa, pero no usa esa réplica para autorizar las confirmaciones.

## Configuración del entorno

Variables que deben definirse para el runtime de Cloud Functions de Sandwichies:

- `CUPBOARD_PROJECT_ID`: `cupboard-app-ce528`.
- `CUPBOARD_HOUSEHOLD_ID`: ID real del hogar dueño de Cupboard.
- `CUPBOARD_INGREDIENT_MAP_JSON`: opcional; permite sobrescribir el mapeo incorporado en `app/shared/catalog.js`. No es necesario configurarlo para los 11 ingredientes actuales.

Los 11 ingredientes activos conservan sus IDs semánticos en recetas y pedidos, pero cada uno apunta a un ID canónico único `N-#######` del catálogo compartido de Cupboard. Los ingredientes no son una colección ni una clase de inventario independiente: son productos de Negocio que Sandwichies utiliza en sus recetas. El mapeo incorporado se valida como completo, único y con prefijo `N-`. El producto debe existir bajo `productCatalog/{N-#######}` y su saldo bajo `households/{householdId}/workspaces/sandwichies/inventory/{N-#######}`. El código de barras es un atributo separado y no forma parte de la identidad. Las cantidades tienen que corresponder a la unidad nativa usada por la receta (por ejemplo gramos para pimentón y unidades para pepperoni). La integración actualiza el campo `unit` para que Cupboard muestre esa unidad.

Copia `app/.env.example` al archivo local `app/.env` y reemplaza el ID del hogar según el entorno. No guardes claves privadas, JSON de cuentas de servicio ni credenciales en el repositorio.

## Permisos entre proyectos

Concede `roles/datastore.user` en el proyecto Cupboard a la identidad de servicio que realmente ejecuta las Cloud Functions de Sandwichies. Usa la identidad configurada en el runtime del proyecto; no asumas un correo de cuenta de servicio y no descargues ni guardes claves privadas. La configuración de proyecto, hogar y mapa no sustituye esos permisos.

## Seguridad y liberación

Los cambios directos de estado desde el navegador están bloqueados por Firestore Rules. La callable verifica permisos de administrador y transiciones válidas. El pago solo puede marcarse después de confirmar el pedido. `BUSINESS.acceptingOrders` permanece en `false`; esta implementación no despliega Functions ni Rules ni habilita pedidos.

## Validación pendiente

`npm run integration:test` incluye pruebas para descuento único, reintento idempotente, reversión y stock insuficiente. Aún deben ejecutarse las pruebas en el entorno local; también hay que verificar el ID real del hogar, los IDs de productos, IAM y el flujo en las dos aplicaciones. No se considera validada la conexión operativa hasta completar esas comprobaciones.