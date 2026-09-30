# Arquitectura

```text
Customer UI → callable createOrder → shared validation/pricing → Firestore
Admin UI ← Firestore (admin claim only)
```

`shared/catalog.js` define ingredientes, unidades, paquetes y porciones. `shared/business.js` define parámetros operativos. `shared/pricing.js` calcula consumo, costo, precio y totales de forma determinista. `shared/order-request.js` valida la petición y crea el objeto de orden confiable.

React puede mostrar una previsualización, pero no es autoridad para totales, costos, utilidad, estado o consecutivo. `functions/index.js` los reconstruye y asigna el consecutivo mediante transacción.
