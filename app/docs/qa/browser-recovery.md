# Fase F — Agente de QA de navegador y recuperación

Este gate manual no declara éxito a partir de pruebas unitarias ni de un build.

## Preparación segura

- [ ] Confirmar que Vite usa Firestore en 127.0.0.1:8080.
- [ ] Confirmar Worker local en 127.0.0.1:8787 y LOCAL_DEV=true.
- [ ] Confirmar proyecto Firebase demo/emulador; detenerse si el destino es remoto.
- [ ] Usar una cuenta de prueba verificada y datos sintéticos.
- [ ] Confirmar BUSINESS.acceptingOrders=false y ORDERS_ENABLED=false.

## Recorrido de navegador

1. Iniciar sesión en storefront y comprobar restauración del carrito.
2. Abrir «Mis pedidos»; comprobar estado vacío y error de red.
3. Consultar un pedido propio; comprobar que costos y consumo interno no aparecen.
4. Consultar un ID de otro usuario; la API debe responder 404 sin revelar existencia.
5. Abrir dos perfiles de navegador con la misma cuenta y comprobar historial consistente.
6. Cerrar sesión en una pestaña; comprobar limpieza de información en memoria.
7. Iniciar sesión en otro navegador; recuperar historial y detalle desde Worker.
8. Simular desconexión durante la consulta; reintentar sin duplicar registros.
9. Verificar actualización del tracking privado de mesa.
10. Revisar responsive 320–430 px, tablet y desktop, teclado, foco y accesibilidad.

## Resultado

Registrar fecha, commit, navegador/versión, entorno demo, pasos PASS/FAIL y capturas sin datos personales. Marcar BLOCKED si requiere servicios o credenciales reales. Nunca crear pedidos reales, habilitar recepción, desplegar ni modificar inventario real.
