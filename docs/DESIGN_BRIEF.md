# Sleevebook — Design brief

> Guárdalo en `docs/DESIGN_BRIEF.md`. Úsalo como respuesta a `/teach-impeccable` y como contexto en cualquier tarea de UI.

## Concepto: la galería privada

Sleevebook no es una app de inventario: es una **sala privada donde se exhibe una colección**. Visitar un binder tiene que sentirse como entrar a una galería de noche o abrir un estuche de relojería: silencio, luz dirigida, materiales nobles y cada pieza presentada con ceremonia.

- **Tres palabras:** íntimo, preciso, luminoso.
- **Referencias de sensación (no de copia):** vitrinas de relojería, casas de subasta, libros de arte encuadernados en tela, la caja de un producto premium al abrirse.
- **Lo que NO es:** dashboard SaaS, gradientes morados, tarjetas con sombras genéricas, emojis, colores de marca Pokémon, interfaz "gamer" con neón.

## Materiales y color

La interfaz es el estuche; las cartas son la joya. La UI se retira para que el foil y el arte de las cartas brillen.

| Token | Uso | Dirección |
|---|---|---|
| `--velvet` | Fondo principal | Casi negro con tinte cálido (no `#000`): terciopelo oscuro |
| `--leather` | Superficie del binder, paneles | Marrón-negro o verde botella muy oscuro, con textura sutil de cuero/tela |
| `--linen` | Texto principal | Blanco hueso cálido, nunca blanco puro |
| `--smoke` | Texto secundario | Gris cálido con 60–70 % de contraste |
| `--foil` | Acento único | Dorado champaña, usado con mucha moderación: filetes, estados activos, el número de avance |
| `--sleeve` | Fundas | Transparencia con reflejo especular; nunca opaco |

- Un solo acento. El color fuerte lo ponen las cartas.
- Modo claro opcional como "papel de algodón y tinta", pero el modo oscuro es la experiencia principal.

## Tipografía

- **Display:** serif de alto contraste con carácter editorial (candidatas libres: Instrument Serif, Gloock, Bodoni Moda, Cormorant Garamond). Usar en titulares grandes y con mucho aire, nunca en botones.
- **Texto e interfaz:** grotesca limpia y precisa (candidatas: Hanken Grotesk, Manrope, Geist). Nada de Inter ni Roboto.
- **Datos:** mono discreta con cifras tabulares para precios, códigos `S3·B·5` y porcentajes.
- Mayúsculas pequeñas con tracking amplio para etiquetas ("MASTER SET", "SHEET 3").

## Movimiento: lento, físico, con intención

El movimiento es el lujo. Nada aparece de golpe; todo tiene peso.

| Momento | Comportamiento | Duración / curva |
|---|---|---|
| Entrar a un binder | El binder cerrado aparece en la luz, se abre la tapa y la cámara se acerca a la primera cara | 1,2–1,8 s total, coreografiado |
| Pasar página | La hoja se curva desde la esquina y cae con inercia; la sombra se mueve con ella | 600–900 ms, seguible con el dedo |
| Sacar una carta | Se desliza fuera de la funda, se eleva hacia el centro y el fondo se oscurece | Spring suave (sin rebote visible) |
| Inclinar carta | El foil responde a puntero o giroscopio con reflejo especular | Seguimiento inmediato, retorno con spring |
| Reordenar | Las cartas vuelan a su nuevo lugar en paralelo, con escalonado mínimo | 500–700 ms, FLIP |
| Cambiar de vista | Transiciones compartidas entre páginas (View Transitions / shared layout) | 400–600 ms |
| Hover | Luz que se desplaza sobre la superficie, no cambios de color bruscos | 200–300 ms |

- Curvas de salida largas (ease-out exponencial); evitar `linear` y rebotes caricaturescos.
- Scroll suave (Lenis) solo en páginas editoriales, no en el editor.
- Animar solo `transform` y `opacity`; 60 fps en móvil de gama media.
- `prefers-reduced-motion`: fundidos breves, sin inclinación ni curvatura.
- Sonido opcional y apagado por defecto: un roce de funda y un giro de página muy sutiles.

## Composición

- Mucho espacio negativo. El binder es el centro; la UI vive en los bordes y se oculta mientras se hojea.
- Luz dirigida: un halo suave detrás del binder abierto, como un foco de vitrina.
- Detalles de oficio: filetes finos dorados, numeración tipo catálogo, texturas a baja opacidad, esquinas precisas.
- Las cifras importantes (valor, % de avance) se presentan como en un catálogo de subasta: grandes, en serif, con su etiqueta en versalitas.

## Pantallas clave para diseñar primero

1. **Portada pública de un binder** (lo que ve alguien que abre un link): binder cerrado, título, dueño, avance, botón "Abrir".
2. **Binder abierto** con dos caras visibles, navegación mínima y detalle de carta al tocar.
3. **Detalle de carta**: carta grande con foil interactivo, datos de catálogo, precio con fuente y fecha.
4. **Landing de Sleevebook**: el hero es un binder real hojeándose solo, no un texto con un botón.

## Criterio de calidad

Antes de dar una pantalla por terminada: ¿un coleccionista la sacaría como captura para mostrarla? ¿Se siente como abrir algo valioso? Si parece una app genérica con cartas encima, no está lista.
