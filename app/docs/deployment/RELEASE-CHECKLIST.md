# Checklist de release

Current evidence and no-go state: [release checklist](../RELEASE-CHECKLIST.md). The historical operational gates below remain in force.

## Estado

acceptingOrders = false se mantiene hasta que todos los bloqueos de release tengan evidencia real.

**Estado vigente (2026-11-08):** `main` mantiene `BUSINESS.acceptingOrders = false` y `ORDERS_ENABLED = false`. El release sigue bloqueado hasta completar los gates de esta checklist. No habilitar pedidos para probar ni enviar solicitudes POST de prueba a producción.

## Pre-release técnico

- [ ] Ejecutar npm ci
- [ ] Ejecutar npm run audit
- [ ] Ejecutar npm run lint
- [ ] Ejecutar npm test
- [ ] Ejecutar npm run security:test
- [ ] Ejecutar npm run build
- [ ] Ejecutar npm run smoke
- [ ] Ejecutar npm run release:verify con `RELEASE_BASE_URL`, `RELEASE_WORKER_URL` y `RELEASE_FIREBASE_PROJECT_ID` configurados. El script solo consulta páginas, `/health` y una sesión no autenticada; no crea pedidos.

## Firebase, Cloudflare Worker y producción

- [ ] Confirmar proyecto objetivo: sandwich-pro
- [ ] Confirmar configuración de producción y dominio
- [ ] Desplegar Rules sólo con aprobación explícita
- [ ] Verificar que Firebase Auth emite ID tokens para el proyecto esperado
- [ ] Verificar Firestore Emulator en pruebas; no ejecutar escrituras reales durante QA
- [ ] Configurar credenciales de servicio independientes para Sandwichies y Cupboard en el almacén seguro de Cloudflare
- [ ] Revisar permisos IAM mínimos, CORS y variables del Worker antes de cualquier despliegue
- [ ] Verificar `GET /health` y `GET /v1/session` sin token (401) en el Worker publicado
- [ ] Verificar `ordersEnabled=false` en el Worker publicado
- [ ] Confirmar que el endpoint de creación rechaza pedidos mientras ambos gates siguen en false; solo mediante prueba aislada/emulador, nunca con POST de prueba en producción
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

Registrar fecha/hora de cada comando, resultado, URL/proyecto objetivo, commit SHA, screenshots de cliente/admin, resultado de Rules Emulator, resultado de smoke y respuesta de health del Worker. No almacenar tokens, secretos ni datos personales.

No almacenar secretos en el repositorio.
