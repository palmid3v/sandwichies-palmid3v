# Flujos de usuario

## Cliente

1. Explora recetas canónicas con búsqueda y categorías; precio/orden son filtros secundarios plegables.
2. Agrega una receta existente al carrito; el resumen fijo móvil muestra cantidad y total y lleva al pedido.
3. Revisa cantidad, descripción, precio, contacto, modalidad, pago y notas.
4. Si selecciona punto de encuentro, indica GPS o pin manual; la callable valida el punto contra polígonos activos antes de aceptar.
5. El cliente envía sólo su configuración a `createOrder`; el backend calcula y guarda los valores finales y asigna mesa virtual cuando aplica.
6. Tras guardar se muestra confirmación/tracking privado y se abre WhatsApp con el resumen. Abrir/cerrar WhatsApp no prueba que el mensaje fue enviado.

**Release:** aunque el flujo cliente use el guard de `BUSINESS.acceptingOrders`, `main` está en `true` desde `270303d` mientras la política requiere `false` hasta aprobación. No hacer pedidos reales ni desplegar mientras esta discrepancia siga abierta.

## Administración

1. El usuario inicia sesión.
2. La UI exige el custom claim `admin: true`.
3. La cola muestra estado, pago, teléfono, modalidad y siguiente transición; los contadores del dashboard abren pedidos filtrados.
4. El detalle permite navegar al punto exacto de encuentro cuando existe y distingue esa modalidad de recogida/domicilio.
5. El administrador cambia estado por callable segura, cambia pago bajo las reglas y consulta dashboard e inventario con semántica correcta.
