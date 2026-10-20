# Sleevebook — Design brief (v2, "Estante")

> Reemplaza a la v1 "la galería privada" (2026-10-19): el usuario la encontró demasiado lujosa y de revista para jugadores y coleccionistas de TCG. Referencia visual aprobada: el lienzo [Sleevebook — nuevas direcciones visuales](https://claude.ai/artifact/UXGU24zvijTbojmV9Enqjz), artboards "A · Estante" y "A + binder de verdad" (laptop y móvil).

## Concepto: app amable, binder de verdad

Sleevebook es una **aplicación** para jugadores y coleccionistas: clara, cercana, rápida de usar. La interfaz se comporta como una buena app de colección (navegación evidente, tarjetas, chips, botones que se ven como botones). **El binder es la excepción con oficio**: se presenta como un objeto físico real (tapa con textura y costura, lomo con anillas, hojas de papel, fundas con brillo) y en laptop se exhibe con calidad distinguida.

- **Tres palabras:** amable, clara, coleccionable.
- **Lo que NO es:** revista/editorial de lujo (nada de serif de revista, terciopelo, oro), dashboard SaaS gris, gradientes morados, emojis, colores de marca Pokémon, neón gamer, grilla plana como representación del binder.

## Color (tokens en `apps/web/src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F5F6FA` | Fondo de la app |
| `--surface` | `#FFFFFF` | Tarjetas, barras, paneles |
| `--surface-2` | `#F1F3F8` | Campos, chips neutros, hover suave |
| `--ink` | `#1B2033` | Texto principal |
| `--muted` | `#5B6278` | Texto secundario (contraste AA sobre blanco y `--bg`) |
| `--line` | `#E3E6EF` | Bordes y separadores |
| `--accent` | `#3451D1` | Acento único de la interfaz: acciones primarias, estado activo, progreso |
| `--accent-strong` | `#2238A8` | Hover/pressed del acento |
| `--accent-soft` | `#EEF1FD` | Fondo de navegación activa y chips del acento |
| `--success` / `--success-soft` | `#127A45` / `#E8F7EE` | Completo, disponible |
| `--warning` / `--warning-soft` | `#8A5A00` / `#FFF4D6` | Reservado, avisos |
| `--danger` / `--danger-soft` | `#B42318` / `#FDECEA` | Vendido, eliminar, errores |
| `--coral` | `#FF6B4A` | Punto de avisos sin leer (solo ese uso) |

El color fuerte lo ponen las cartas y la tapa de cada binder. La interfaz usa un solo acento.

**Binder (objeto):** la tapa toma el color del tema del binder (`--binder-cover`, por defecto `#2F4A8A`; tono profundo calculado), con textura sutil y costura punteada; hojas color papel (`#FBFBF7` con degradé hacia el lomo); anillas metálicas (grises con brillo); fundas transparentes con reflejo especular diagonal. Los temas (`clasico`, `oscuro`, `vintage`, `neon`) cambian tapa, papel y funda, nunca la interfaz alrededor.

## Tipografía

- Una familia: **Plus Jakarta Sans** (`--font-ui`; también `--font-display` y `--font-data` apuntan a ella).
- Títulos: 700–800, tracking −0.01em. H1 de página 24–28 px; dentro de tarjetas 18–22 px. Nada de títulos gigantes: el binder es el protagonista.
- Texto 14–16 px, 400–500. Etiquetas 12–13 px 600, sin mayúsculas forzadas.
- Números (precios, conteos, códigos): `font-variant-numeric: tabular-nums` (clase `.sb-data`).

## Forma y espacio

- Radios: 10 px (botones pequeños, chips de borde), 12–14 px (botones, campos), 16–20 px (tarjetas), 999 px (chips/píldoras).
- Sombras suaves y cortas: `0 1px 2px rgba(27,32,51,.06), 0 8px 24px rgba(27,32,51,.06)`. El binder tiene su propia sombra profunda (objeto sobre la mesa).
- Espaciado en múltiplos de 4; páginas con 20 px de margen en móvil y 40 px en laptop; contenido hasta 1320 px.
- Objetivos táctiles ≥ 44 px.

## Componentes

- **Navegación:** laptop = barra superior blanca (logo, enlaces en píldora con estado activo `--accent-soft`, buscador, botón "Escanear", avatar). Móvil = barra inferior con 5 destinos (Binders, Deseos, Escanear al centro como botón destacado, Cambios, Cuenta) y cabecera simple con volver/título/acciones.
- **Botón primario:** fondo `--accent`, texto blanco, 600–700. **Secundario:** blanco con borde `--line`. **Fantasma:** texto `--accent` sin borde.
- **Tarjeta:** `--surface`, radio 20, sombra suave, padding 16–20.
- **Chips:** píldoras pequeñas para estado (Completo, 155/155, US$, Vendido, Reservado).
- **Progreso:** barra de 8 px redondeada en `--accent` (o `--success` al 100 %).
- **Vacíos:** texto amable + acción clara.

## El binder

- **Laptop:** spread abierto al centro sobre una "mesa" clara con luz suave (degradé radial blanco → `--bg`); tapa con margen visible alrededor de las hojas, costura punteada, lomo central con tres anillas; cada carta en su funda. Pasar página con la curvatura 3D, sacar/voltear carta, binder cerrado que gira: se mantienen y deben sentirse premium.
- **Móvil:** una hoja a la vez (lomo y anillas al costado izquierdo), se pasa deslizando con el dedo o con botones; puntos de página. Animaciones livianas: deslizamiento/fundido, sin curvatura 3D ni giro del binder cerrado (se muestra la tapa estática con "Abrir"). El detalle de carta y el holo se mantienen.
- Encima del binder, solo una franja compacta: nombre, chips de progreso y valor, acciones. Nada de cifras gigantes.

## Movimiento

- Microinteracciones 150–250 ms, `--ease-out-expo`; transform/opacity solamente.
- `prefers-reduced-motion`: sin inclinación ni curvatura; fundidos.

## Accesibilidad

- Contraste AA (4.5:1 texto, 3:1 elementos grandes y bordes de control).
- Foco visible: anillo de 2 px `--accent` con 2 px de separación.
- Botones reales, labels reales, `aria-label` en botones de solo ícono, íconos SVG de trazo (nunca emoji).
