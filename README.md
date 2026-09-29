# 🥪 Sandwichies

Aplicación web para configurar sandwiches personalizados y operar pedidos desde un panel administrativo. Proyecto productivo SENA en evolución.

## Estado actual

| Área | Estado |
| --- | --- |
| Arquitectura compartida | 🟢 |
| Pedidos confiables | 🟢 |
| Modelo de costos/pricing | 🟢 |
| Rediseño visual tropical | 🟢 |
| Documentación base | 🟢 |
| Admin con `admin: true` | 🟡 |
| Firebase Emulator | 🔴 |
| Costos granulares por ingrediente | 🟡 |
| Consumo de base según selección | 🔴 |
| Data Connect | 🟡 |
| Dependencias / audit | 🟡 |
| Release producción | 🔴 |
| Política de ventas | 🟡 |
| Semántica de WhatsApp | 🟡 |
| PWA | ⚪ Futuro / no implementado |

### Estado operativo actual

`acceptingOrders: false`

El storefront y la Cloud Function no aceptan nuevos pedidos mientras este valor permanezca así.

---

## Producto actual

Sandwichies permite:

- construir sandwiches de 15 cm o 30 cm;
- seleccionar varias proteínas y cantidades de 1 a 3 por proteína;
- seleccionar base, toppings y extras;
- usar doble proteína y queso extra;
- agregar múltiples sandwiches al carrito;
- elegir recoger o domicilio;
- elegir método de pago y añadir notas;
- guardar pedidos mediante una Cloud Function confiable;
- abrir WhatsApp con el resumen del pedido;
- operar pedidos desde un panel administrativo;
- consultar dashboard e inventario estimado.

La zona de recomendaciones permanece como placeholder hasta definir las combinaciones definitivas.

---

## Arquitectura actual

```text
Customer UI
    ↓
createOrder (Firebase callable)
    ↓
shared/
    ├── catalog.js
    ├── business.js
    ├── pricing.js
    └── order-request.js
    ↓
Firestore
    ↓
Admin UI
```

### Fuente de verdad

- `shared/catalog.js` → ingredientes, tamaños, costos, cantidades y consumo.
- `shared/business.js` → configuración comercial/operativa.
- `shared/pricing.js` → costo, precio, consumo, delivery y utilidad.
- `shared/order-request.js` → validación y construcción confiable de órdenes.

React muestra previews, pero no es la autoridad final para totales, costo, utilidad, estado o consecutivo.

---

## Costos y pricing

Los costos actuales deben mantenerse en:

```text
shared/catalog.js
shared/business.js
```

El modelo usa:

```text
packageCost
    ÷
packageQuantity
    =
unit cost
    ↓
portionQuantity
    ↓
ingredientUsage
    ↓
sandwich cost
    ↓
sale price
```

También se centralizan:

- tamaño;
- pan;
- cantidad de proteína;
- doble proteína;
- toppings;
- queso extra;
- extras;
- domicilio;
- multiplicador;
- redondeo.

No duplicar fórmulas monetarias dentro de React.

---

## Seguridad y Admin

La convención actual es:

```js
{ admin: true }
```

El mismo claim se usa en el frontend y en las reglas de Firestore.

La ruta administrativa sigue:

```text
Firebase Auth
    ↓
admin: true
    ↓
/admin
    ↓
Firestore protegido
```

El script existente es:

```bash
npm run provision:admin
```

Solo modifica un usuario existente mediante Firebase Admin SDK; no crea cuentas.

La verificación real del claim en el entorno Firebase objetivo continúa pendiente.

---

## Inventario

El inventario actual es una **estimación de capacidad**, no inventario transaccional.

Se alimenta de `ingredientUsage` y de las cantidades configuradas en el catálogo.

Todavía no representa:

- compras;
- desperdicios;
- reservas;
- movimientos de stock reales.

---

## Visual Identity

La interfaz actual usa una identidad tropical orientada a alimentos:

- 🟢 deep leafy green
- 🟢 tropical green
- 🟡 lime
- 🟡 mango
- 🟠 papaya
- 🔴 coral
- 🤍 warm cream

La dirección visual es fresca, energética, gastronómica y moderna.

**No forma parte del proyecto una estética de AI brand, chatbot o futuristic AI SaaS.**

La interfaz incluye responsive design, transiciones CSS y soporte para `prefers-reduced-motion`.

---

## Calidad actual

Comandos principales:

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
```

La suite de dominio existente cubre pricing, tamaños, consumo, extras, delivery y validación de requests.

Siguen pendientes las pruebas con Firebase Emulator para reglas, claims, callable function y concurrencia del contador.

---

## Documentación

```text
docs/
├── product/
├── architecture/
├── development/
├── deployment/
├── tasks/
├── audits/
└── v0.1/        # histórico
```

La documentación actual y el histórico v0.1 se conservan deliberadamente para mantener trazabilidad.

---

## Historia del proyecto

El proyecto comenzó como un sandwich builder y fue evolucionando hacia una solución de negocio más estructurada.

### TASK-000 — Auditoría inicial

Se realizó una auditoría del proyecto para identificar:

- seguridad;
- integridad de pedidos;
- costos;
- datos;
- dependencias;
- UX/UI;
- deuda técnica.

### TASK-001 — Seguridad, pedidos y dominio

Se implementaron:

- creación confiable de pedidos;
- catálogo compartido;
- pricing centralizado;
- costos y consumo;
- custom claim administrativo;
- reglas Firestore restrictivas;
- consecutivo transaccional;
- pruebas de dominio.

### TASK-002 — Consolidación y rediseño

Se implementaron:

- limpieza;
- nueva estructura documental;
- README actualizado;
- nueva identidad tropical;
- rediseño customer/admin;
- responsive;
- motion CSS;
- reduced motion;
- placeholder de recomendaciones.

---

## Pendientes actuales

Los pendientes deben revisarse según la tabla de **Estado actual** al inicio del documento.

Los principales bloqueantes actuales son:

1. completar provisioning/verificación del administrador;
2. configurar Firebase Emulator;
3. corregir la relación entre selección de base y consumo real;
4. decidir si los costos de base deben granularizarse por ingrediente;
5. revisar Data Connect no integrado;
6. revisar dependencias vulnerables;
7. definir política de venta;
8. definir semántica de WhatsApp;
9. preparar release de producción.

No se debe esconder un pendiente dentro de documentación ni declararlo completado sin validación real.

---

## Workflow del proyecto

La responsabilidad se mantiene así:

```text
Idea
  ↓
NexSy: análisis / UX / arquitectura / documentación
  ↓
Usuario: aprobación
  ↓
TASK
  ↓
Codex: implementación / pruebas
  ↓
Codex REPORT
  ↓
NexSy: revisión / auditoría
  ↓
Usuario: validación
  ↓
Documentación
  ↓
Siguiente TASK
```

Cuando código y documentación contradicen:

```text
identificar
↓
reportar
↓
decidir
↓
actualizar
↓
implementar
```

---

## SENA — Proyecto Productivo

La documentación del proyecto conserva evidencia técnica y de producto relacionada con:

- contexto;
- alcance;
- requisitos;
- reglas de negocio;
- arquitectura;
- implementación;
- pruebas;
- seguridad;
- deployment;
- tareas;
- auditorías;
- decisiones;
- trazabilidad.

No se deben inventar requisitos, aprobaciones o evidencias institucionales.

---

## Principle

> **Build the product, protect the data, keep the business rules understandable, document every important step, and never lose the history of how Sandwichies got here.**
