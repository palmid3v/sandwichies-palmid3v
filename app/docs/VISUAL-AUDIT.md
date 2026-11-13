# Auditoría visual — Sandwichies

## Estado inicial

La inspección en Chrome, en viewport móvil y con esquema oscuro emulado, mostró que el login y varias superficies del storefront se renderizaban crema/claro. Dos hojas de estilo globales declaraban `color-scheme: light` y sobrescribían superficies. En móvil, los accesos de cuenta se solapaban, el constructor de sándwich estaba oculto y no quedaba una entrada directa a personalizar. Los saldos de inventario con Worker desconectado quedaban en estado de consulta indefinido.

## Dirección y correcciones

- Establecido “Night Deli”: carbón/espresso, crema, mostaza, coral y verde menta medido.
- Unificado `color-scheme: dark` en documento, controles nativos, autofill, scrollbars y hojas legadas.
- Añadida una capa de estilos visuales para login, storefront, catálogo, constructor, carrito, checkout, perfil y admin.
- Recuperada la fotografía hero existente y preservada la imagen de cada producto.
- Separados los enlaces de perfil y pedidos de la acción de cerrar sesión; añadido enlace visible al constructor en móvil.
- Clarificado el estado de inventario sin Worker local, limitado a la pestaña correspondiente.
- Añadido proxy Vite local al Worker en el puerto documentado 5182, necesario para que la escritura del carrito de prueba respete la allowlist existente.

## QA en navegador

Chrome DevTools real, con `colorScheme=dark` y movimiento reducido. Storefront recorrido a 320×720, 390×844, 430×932, 768×1024, 1440×900 y 1920×1080; admin recorrido a 390×844, 768×1024, 1440×900 y 1920×1080. En las mediciones, `documentElement.scrollWidth` coincidió con `innerWidth`, `color-scheme` fue `dark` y el fondo del body fue `rgb(16, 15, 13)`.

Se verificaron la pantalla de acceso, home/catálogo, tarjetas, personalización, carrito vacío y carrito con artículo de prueba, checkout con pedidos cerrados, perfil e historial vacío del cliente, y admin en pedidos, resumen, inventario y entregas. El artículo de carrito de prueba se eliminó tras validar sincronización. No se creó una orden en esta misión.

## Pendientes / límites

- La pestaña Entregas devolvió el error genérico del endpoint local y no había mesas sintéticas; sólo se validó el estado de error/vacío y el layout.
- En la repetición final del flujo, el Worker local sí leyó existencias e historial ya poblados de Cupboard desde la configuración local. No se hicieron escrituras ni ajustes. El Worker se detuvo al detectar que no eran datos sintéticos y no se hicieron más lecturas.
- La configuración local de Worker/Cupboard no es adecuada para QA visual con inventario de demostración. Mantener el Worker apagado hasta disponer de bindings aislados de prueba.
- Con pedidos deshabilitados no existe una orden real de prueba para revisar su detalle/historial ni el estado visual de éxito de checkout.
- El porcentaje de calidad visual no se considera 100% mientras esas pantallas/estados no puedan validarse en un entorno local seguro con datos sintéticos.

## Severidades encontradas

| Área | Hallazgo | Estado |
| --- | --- | --- |
| Global | Cascada light heredada pese a esquema oscuro | Corregido y revalidado |
| Home móvil | Accesos de perfil/pedidos superpuestos; builder oculto | Corregido y revalidado |
| Catálogo móvil | Fila compacta y contraste de fotos/selección | Ajustado y revalidado |
| Inventario local | Spinner/saldo indefinido al perder Worker | Estado de indisponibilidad explícito; datos obtenidos al reconectar no se usaron para escrituras |
| Entregas | Endpoint local devuelve error genérico con Worker detenido | Bloqueado por servicio local; no se volvió a consultar tras detectar Cupboard poblado |

## Evidencia

Ver capturas en [`visual-evidence/`](visual-evidence/): storefront móvil, checkout móvil, admin inventario móvil y entregas en móvil/desktop.
