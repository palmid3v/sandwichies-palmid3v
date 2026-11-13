# Visual release checklist

## Criterios y evaluación basada en evidencia

| Dominio | Peso | Puntuación | Evidencia / límite |
| --- | ---: | ---: | --- |
| Identidad retro 80s | 15% | 13% | Night Deli aplicado a storefront y admin; acabado de rutas menos usadas aún requiere revisión visual completa. |
| Dark-only | 15% | 15% | CSS heredado corregido; `color-scheme: dark` y fondo oscuro medidos en rutas/anchos inspeccionados. |
| Storefront mobile-first | 20% | 18% | Home, catálogo, personalizador, carrito y perfil recorridos; algunas variantes de formularios no se cubrieron en estados de error. |
| Checkout | 10% | 8% | Formulario y cierre visibles y verificados; orden/confirmación de éxito no validables por regla de negocio. |
| Admin desktop/mobile | 20% | 17% | Pedidos/resumen/inventario/entregas recorridos; endpoint de entregas falla y no había pedidos para detalle/acciones. |
| Responsive | 10% | 10% | Sin overflow en 6 tamaños storefront y 4 admin medidos. |
| Accesibilidad e interacción | 5% | 4% | Foco, controles de 44–48 px, reduced motion y dark controls cubiertos; auditoría automatizada completa pendiente. |
| Consistencia/acabado | 5% | 4% | Tokens y evidencia añadidos; faltan estados que requieren entorno de prueba aislado. |
| **Total verificado** | **100%** | **89%** | No declarar 100%: faltan estados condicionados por backend y checkout cerrado. |

La suma refleja juicio conservador basado en las comprobaciones documentadas, no cantidad de archivos ni features planeadas. El 11% pendiente corresponde sobre todo a estados no disponibles para validación segura (checkout exitoso, detalle de pedido, mesas/entregas y aislamiento de integración de inventario).

## Lista de salida

- [x] Dark-only global y controles nativos oscuros.
- [x] Pedidos siguen cerrados; no se envió ningún pedido.
- [x] Storefront y admin probados con tamaños móviles, tablet y desktop.
- [x] Carrito sintético sincronizado y luego vaciado.
- [x] Sin overflow horizontal en las medidas registradas.
- [x] Capturas principales guardadas en `docs/visual-evidence/`.
- [x] `npm run lint`.
- [x] Pruebas unitarias de Worker: 87 pasaron.
- [x] Pruebas unitarias de app: 43 pasaron.
- [x] `npm run build`, `performance:check` y `smoke`.
- [x] Consola y solicitudes del perfil del cliente en 5182: sin errores; perfil/direcciones respondieron 200.
- [x] Lighthouse snapshot: Accessibility 100 y Best Practices 100 en storefront móvil (390×844) y login admin desktop (1440×900).
- [ ] Estado de éxito/seguimiento de orden: requiere una estrategia de prueba local que conserve los flags cerrados.
- [ ] Entregas con datos sintéticos y backend local aislado.
- [ ] Auditoría Lighthouse y teclado/contraste para todas las rutas y estados; las dos capturas auditadas no cubren toda la aplicación.
- [ ] `npm run check` completo: se detuvo en `security:test` porque el emulador Firestore no pudo tomar el puerto 8080 ya ocupado; por ello tampoco corrió `integration:test` dentro de esa cadena.
- [x] `npm audit --omit=dev` reportó 6 hallazgos moderados transitivos (umbral configurado en alto); no se hicieron upgrades como parte de la misión visual.

Las auditorías Lighthouse también reportaron fallos de robots.txt, llms.txt y ARD en el build local; son hallazgos SEO/descubribilidad y no afectan el resultado visual ni de accesibilidad.

## Resultado

Calidad visual verificada: **89%**. Estado: **PARCIALMENTE VERIFICADO**, no listo para afirmar 100% visual. El Worker local quedó detenido después de detectar que la integración de Cupboard local devolvía datos poblados; no se escribió ni alteró inventario. No es una autorización para desplegar ni para abrir pedidos.
