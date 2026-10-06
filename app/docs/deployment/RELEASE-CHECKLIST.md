# Checklist de release

## Estado

acceptingOrders = false se mantiene hasta que todos los bloqueos de release tengan evidencia real.

## Pre-release técnico

- [ ] Ejecutar npm ci
- [ ] Ejecutar npm run audit
- [ ] Ejecutar npm run lint
- [ ] Ejecutar npm test
- [ ] Ejecutar npm run security:test
- [ ] Ejecutar npm run build
- [ ] Ejecutar npm run smoke
- [ ] Ejecutar npm run release:verify contra la URL objetivo

## Firebase / producción

- [ ] Confirmar proyecto objetivo: sandwich-pro
- [ ] Confirmar configuración de producción y dominio
- [ ] Desplegar Rules sólo con aprobación explícita
- [ ] Desplegar Functions sólo con aprobación explícita
- [ ] Verificar createOrder responde sin crear pedidos mientras acceptingOrders=false
- [ ] Verificar syncCompletedSaleInventory desplegada
- [ ] Verificar claim admin=true en la cuenta administrativa existente
- [ ] Iniciar sesión en /admin con la cuenta administrativa
- [ ] Confirmar lectura de pedidos
- [ ] Confirmar lectura de saldos e historial de inventario
- [ ] Confirmar acceso denegado para una cuenta no admin

## Smoke operativo

- [ ] Cliente: / carga correctamente
- [ ] Cliente: catálogo/configurador funciona
- [ ] Cliente: checkout sigue bloqueado mientras acceptingOrders=false
- [ ] Cliente: pedido de prueba válido sólo después de habilitación explícita
- [ ] Admin: /admin muestra login para usuario no autenticado
- [ ] Admin: usuario autenticado sin claim queda restringido
- [ ] Admin: usuario con claim puede consultar pedidos
- [ ] Admin: estados siguen las transiciones permitidas
- [ ] Admin: pago sólo pasa de pendiente a pagado
- [ ] Admin: venta completada genera consumo de inventario
- [ ] Admin: compra/ajuste registra movimiento y actualiza saldo
- [ ] Admin: reportes permiten cambiar periodo

## Monitoreo y rollback

1. Conservar el commit previo al release.
2. Registrar fecha, commit, proyecto Firebase, funciones desplegadas y Rules desplegadas.
3. Revisar logs de Functions después del despliegue.
4. Ante un fallo P0/P1, revertir al commit previamente verificado y restaurar la configuración funcional anterior.
5. No poner acceptingOrders=true como mecanismo de prueba.

## Evidencia

Registrar fecha/hora de cada comando, resultado, URL/proyecto objetivo, commit SHA, screenshots de cliente/admin, resultado de Rules Emulator, resultado de smoke y resultado de la verificación de función.

No almacenar secretos en el repositorio.
