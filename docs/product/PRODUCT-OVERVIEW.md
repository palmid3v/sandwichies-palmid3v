# Producto: Sandwiches

Sandwiches permite a clientes configurar una orden de sandwich y a operadores administrar pedidos. El problema que resuelve es ordenar y hacer visible la relación entre configuración, precio, costo estimado y operación.

## Usuarios y alcance

- Cliente: construye un sandwich, aporta datos de entrega/pago y recibe un resumen para WhatsApp.
- Administrador con custom claim: consulta, actualiza estados y revisa estimaciones.

El MVP no incluye pagos integrados, inventario transaccional, compras a proveedores ni recetas recomendadas definitivas.

## Estado

La creación de órdenes se ejecuta en una Cloud Function confiable. La aplicación requiere despliegue/configuración de Firebase antes de funcionar contra un entorno real.
