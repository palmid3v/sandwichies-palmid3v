# Responsive QA

## Método

Aplicación real en `http://127.0.0.1:5182`, Chrome DevTools, `color-scheme: dark`, `prefers-reduced-motion: reduce`. Se midieron `innerWidth`, `document.documentElement.scrollWidth`, esquema computado y fondo computado. El proxy local apunta al Worker de desarrollo en `127.0.0.1:8787`; no es configuración de producción.

## Viewports medidos

| Área | Viewport | Scroll horizontal | Esquema/fondo |
| --- | --- | --- | --- |
| Storefront | 320×720 | No (`320 = 320`) | dark / carbón |
| Storefront | 390×844 | No (`390 = 390`) | dark / carbón |
| Storefront | 430×932 | No (`430 = 430`) | dark / carbón |
| Storefront | 768×1024 | No (`768 = 768`) | dark / carbón |
| Storefront | 1440×900 | No (`1440 = 1440`) | dark / carbón |
| Storefront | 1920×1080 | No (`1920 = 1920`) | dark / carbón |
| Admin | 390×844 | No (`390 = 390`) | dark / carbón |
| Admin | 768×1024 | No (`768 = 768`) | dark / carbón |
| Admin | 1440×900 | No (`1440 = 1440`) | dark / carbón |
| Admin | 1920×1080 | No (`1920 = 1920`) | dark / carbón |

## Pantallas recorridas

| Ruta/pantalla | Mobile | Tablet | Desktop | Nota |
| --- | --- | --- | --- | --- |
| `/` home/login | Sí | Sí | Sí | hero y acceso móvil |
| Catálogo y búsqueda | Sí | Sí | Sí | tarjetas e imágenes existentes |
| Personalizador | Sí | Sí | Sí | opción seleccionada y dock móvil |
| Carrito / checkout | Sí | Sí | Sí | checkout deshabilitado por cierre de pedidos |
| `/perfil` | Sí, incluso 320 px | — | — | sin overflow |
| `/admin` pedidos | Sí | Sí | Sí | lista vacía con datos locales |
| `/admin` resumen | Sí | Sí | Sí | métricas locales |
| `/admin` inventario | Sí | Sí | Sí | offline Worker explicado |
| `/admin` entregas | Sí | — | Sí | endpoint error genérico; layout inspeccionado |

La mayoría de pantallas se recorrieron visualmente; las celdas tablet/admin y desktop/storefront se verificaron por responsive scan. La matriz no implica que las integraciones o los estados con datos inexistentes funcionen.

Lighthouse snapshot en storefront móvil (390×844) y login admin desktop (1440×900): Accessibility **100** y Best Practices **100** en ambas. SEO quedó en 80 por `robots.txt`; Agentic Browsing en 33 por `llms.txt` y ARD. Estas categorías no miden la calidad visual. El login admin es el estado que se auditó para esa ruta; no equivale a auditoría Lighthouse del dashboard autenticado.

## Capturas

- [Storefront móvil](visual-evidence/storefront-mobile.jpg)
- [Checkout móvil](visual-evidence/checkout-mobile.jpg)
- [Inventario admin móvil](visual-evidence/admin-inventory-mobile.jpg)
- [Entregas admin móvil](visual-evidence/admin-deliveries-mobile.jpg)
- [Entregas admin desktop](visual-evidence/admin-deliveries-desktop.jpg)

## Límites

La vista de entregas mostró “No fue posible completar la solicitud” con cero mesas locales mientras el Worker estaba detenido. En una repetición final, el Worker local leyó inventario e historial ya poblados de Cupboard; no se efectuaron escrituras y se detuvo al reconocer que los datos no eran sintéticos. No se hicieron lecturas adicionales. El checkout está correctamente cerrado y no se enviaron pedidos.
