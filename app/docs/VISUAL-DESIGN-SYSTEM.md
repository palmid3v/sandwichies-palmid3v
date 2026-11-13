# Sandwichies — Night Deli visual system

## Dirección artística

La interfaz combina la calidez de un deli de barrio con carteles pintados de los años 80 y la claridad de un producto digital actual. El lenguaje se apoya en fondos carbón y espresso, bordes cálidos, fotografía de comida existente y acentos de rótulo usados para orientar acciones. La textura y las formas asimétricas aparecen en superficies principales; los controles cotidianos siguen siendo sobrios.

## Dark-only

El producto tiene un único tema. `color-scheme: dark` se declara en la raíz del documento y en los controles nativos; `<meta name="color-scheme" content="dark">` evita que el navegador sugiera controles claros. Las hojas legadas `menu-world.css` y `charcuteria-club.css` comparten tokens oscuros, y `visual-system.css` establece los acabados finales de storefront, perfil y admin. No ofrecer selector de tema ni depender de la preferencia del sistema.

## Tokens semánticos

| Token | Valor | Uso |
| --- | --- | --- |
| `--surface-0` | `#100f0d` | fondo global |
| `--surface-1` | `#191714` | superficie profunda |
| `--surface-2` | `#211e19` | tarjetas y controles |
| `--surface-3` | `#2b2620` | opciones elevadas |
| `--ink` | `#fff1da` | texto principal |
| `--muted` | `#c5b8a6` | texto secundario |
| `--mango` | `#f0c45f` | acción principal y foco |
| `--coral` | `#f07859` | alerta / énfasis gastronómico |
| `--tropical` | `#88c79a` | selección y acento positivo |
| `--lime` | `#b7dc78` | confirmación puntual |
| `--border`, `--border-strong` | crema translúcida | separación y contornos |

Usar primero los tokens existentes de `src/index.css`; evitar nuevos colores aislados. El texto de apoyo sigue siendo crema atenuada, nunca gris casi negro sobre carbón.

## Tipografía

- Display: Fraunces para titulares, nombres de producto y encabezados con carácter.
- Interfaz: DM Sans para navegación, texto, formularios y controles.
- Precios: jerarquía sans legible y peso alto; no usar display decorativa para datos densos.

Las fuentes se cargan desde las declaraciones ya presentes en el proyecto. Mantener saltos naturales en anchuras pequeñas.

## Componentes y estados

- **Primario:** mostaza, texto espresso, mínimo 48 px; hover aclara y eleva discretamente; disabled conserva contraste y explica el estado.
- **Secundario:** fondo oscuro, borde visible y texto crema; foco teclado con aro mostaza de 3 px.
- **Destructivo/alerta:** coral con texto claro y contexto explícito; no comunicar estado sólo con color.
- **Campos/selects:** carbón, borde cálido, placeholder legible, controles nativos en esquema oscuro y autofill oscuro.
- **Cards:** superficie espresso, borde fino, radio amplio y sombra contenida. Las tarjetas de producto priorizan foto, nombre, precio y acción.
- **Tabs/chips:** superficies oscuras; selección combinada con relleno mostaza, borde y contraste de texto.
- **Estados vacíos/errores:** usar mensaje directo y acción de recuperación si existe; nunca sustituir un fallo del servicio por información inventada.
- **Loading:** respetar el estado propio de cada pantalla y `prefers-reduced-motion`.
- **Tablas y listas:** en móvil, apilar contenido y permitir acciones legibles sin forzar una tabla comprimida.

No se añadieron dependencias de componentes visuales. Los estilos finales están centralizados en `src/styles/visual-system.css` y aplicados después de los estilos de cada página.

## Layout responsive

Diseñar primero para 320–430 px: controles táctiles de 44–48 px, filtros plegables cuando corresponde, tarjetas de catálogo compactas y panel del carrito con área segura inferior. A 768 px se permiten columnas cuando el contenido lo soporta. A 1440–1920 px limitar el ancho de lectura y dar espacio a la navegación de admin. Evitar desbordamiento horizontal en todos los puntos.

## Accesibilidad y movimiento

Mantener foco visible por teclado, etiquetas asociadas a campos y estados textuales. Reducir o eliminar transiciones con `prefers-reduced-motion: reduce`. No usar hover como única señal; preservar feedback de pulsación y selección para touch.

## Uso del branding

El hero usa el recurso de comida existente `public/assets/illustrations/sandwich-hero.jpg`. No reemplazar fotografía oficial por imagen generativa. Los acentos de neón son mínimos; mostaza organiza la acción y coral/menta distinguen estados.
