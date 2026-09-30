# Flujos de usuario

## Cliente

1. Selecciona tamaño, base, proteínas, toppings y extras.
2. Ve una estimación calculada por el modelo compartido.
3. Agrega una o más configuraciones al carrito.
4. Ingresa contacto, retiro/domicilio, pago y notas.
5. El cliente envía sólo su configuración a `createOrder`; el backend calcula y guarda los valores finales.
6. Después de guardar se abre WhatsApp con el resumen. Abrir/cerrar WhatsApp no demuestra que el mensaje fue enviado; la semántica de confirmación sigue pendiente de decisión.

## Administración

1. El usuario inicia sesión.
2. La UI exige el custom claim `admin: true`.
3. El administrador ve pedidos, cambia estado/pago y consulta dashboard e inventario estimado.
