# Fase B — Diseño y prototipo responsive

**Fecha:** 2026-10-15  
**Estado:** prototipo estático preparado; aplicación funcional sin cambios visuales en esta fase.

## Objetivo

Acordar la jerarquía visual y los estados críticos antes de implementar cambios en el storefront. El prototipo HTML independiente se encuentra en `app/docs/prototypes/phase-b-storefront.html`.

## Jerarquía propuesta

1. Marca, contexto y acción primaria.
2. Selección de tamaño y acceso rápido a productos favoritos.
3. Descubrimiento de recetas por categoría.
4. Detalle breve de receta: proteínas, ingredientes incluidos y precio de referencia.
5. Configuración personalizada y extras.
6. Resumen persistente del carrito y avance de flujo.
7. Estado de checkout desactivado mientras `acceptingOrders = false`.

## Desktop y móvil

- Desktop: catálogo principal y panel lateral de carrito, con espacio para descubrimiento sin esconder la acción de compra.
- Móvil: una columna, controles táctiles grandes y resumen de carrito compacto; no usar columnas estrechas para las tarjetas.
- Estados contemplados: carga, catálogo vacío, error recuperable, producto seleccionado, carrito vacío, carrito con productos y checkout no disponible.
- Accesibilidad: foco visible, semántica de botones, contraste suficiente y respeto por `prefers-reduced-motion`.

## Límite de esta fase

El prototipo es exploratorio y no está conectado a Firebase ni al flujo real de pedidos. No se modificó el storefront de producción ni se habilitó checkout. La validación visual humana en móvil y escritorio sigue pendiente antes de usarlo como especificación de implementación de Fase C.
