# Sandwiches

Aplicación web para configurar sandwiches, calcular costos/precios de forma consistente y operar pedidos desde un panel administrativo. Es un proyecto productivo en evolución: el MVP cubre el pedido personalizado y su operación; no pretende ser todavía un sistema de inventario transaccional ni de pagos.

## Estado actual

La interfaz cliente y el panel admin comparten un dominio de catálogo/costos. La creación final de órdenes está diseñada para ejecutarse en una Firebase Cloud Function y los roles administrativos usan custom claims. El código está listo para revisión local; no se ha desplegado esta configuración.

## Características

- Configurador de sandwich de 15/30 cm, proteínas, toppings y extras.
- Previsualización basada en costo, consumo y precio determinista.
- Carrito, retiro/domicilio y resumen para WhatsApp.
- Panel protegido por rol con pedidos, estado de pago, métricas e inventario estimado.
- Catálogo, porciones, costos y reglas compartidos por UI y backend.

## Stack y arquitectura

React 19, Vite, Firebase Auth/Firestore/Functions y CSS nativo. El dominio vive en `shared/`; React es una interfaz y `functions/` es la frontera confiable para crear órdenes.

```text
Customer UI → callable createOrder → shared domain → Firestore → Admin UI
```

## Desarrollo local

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
```

Configura Firebase para el entorno correspondiente sin subir secretos. Para operar `/admin`, asigna el custom claim `admin: true` mediante un proceso privilegiado de Firebase Admin SDK y vuelve a iniciar sesión.

## Despliegue

No desplegar sin aprobación explícita. Antes de release, revisar `docs/deployment/RELEASE-CHECKLIST.md`, validar reglas/función con Emulator Suite y hacer smoke tests. El rollback debe conservar la última versión funcional.

## Documentación

Consulta [docs/README.md](docs/README.md) para producto, arquitectura, costos, seguridad, pruebas, release y trazabilidad histórica.
