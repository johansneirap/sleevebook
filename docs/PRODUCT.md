# Sleevebook — documento de producto

Oct 13, 2026 · @Johans

## Cómo usar este documento

Este documento es la fuente de verdad del producto: se pega completo (o exportado a Markdown) como contexto en cualquier agente de código, y se actualiza a medida que avanzamos.

- **Como prompt:** exporta el doc a Markdown y guárdalo como `CLAUDE.md` / `docs/PRODUCT.md` en la raíz del repo. El prompt de arranque para Claude Code vive aparte, en el archivo SLEEVEBOOK_KICKOFF.md.
- **Como spec:** las secciones 4 a 10 describen qué construir y cómo. Un requisito que no esté aquí no existe todavía; si aparece en una conversación, se agrega aquí primero.
- **Como tracking:** la sección *Roadmap* tiene checklists por fase; se marcan aquí. Las decisiones tomadas van al *Registro de decisiones* con fecha.
- **Convenciones:** "carta" = una impresión concreta (set + número + variante). "Pokémon" o "especie" = la criatura. Precios en USD de referencia, con conversión a CLP en la interfaz.
- **Nombre:** *Sleevebook* (elegido el 13-10-2026; dominio sleevebook.com en Cloudflare).

## Visión y propuesta de valor

Un binder digital de cartas TCG que se ve y se siente como uno físico — o mejor — y que se comparte con un link.

**Problema.** Las herramientas actuales tratan la colección como una tabla o una grilla plana. Quien colecciona arma binders físicos con cuidado estético (mosaicos, separadores, orden por era) y no tiene cómo mostrarlos fuera de una foto. Quien vende singles comparte fotos de binders o planillas sin precios actualizados.

**Propuesta.** Tres cosas juntas que hoy no existen en un mismo producto:

1. **Herramienta de diseño:** el binder es un lienzo. Formatos reales de la industria, portadas, paneles de arte que cruzan varios bolsillos, temas y fondos personalizados.
2. **Fidelidad visual:** cartas con efectos holo, reverse, texturas y relieve que reaccionan a la luz; animaciones físicas de páginas y cartas.
3. **Datos vivos:** cada carta conectada a un catálogo y a precios de mercado, con tracking de master sets y de stock.

**Primer TCG:** Pokémon (inglés, luego japonés y español). El modelo de datos queda abierto a otros TCG (One Piece, Magic, Lorcana) sin reescribir el binder.

**Punto de partida real:** este proyecto nace de los master sets Zorua/Zoroark y Riolu/Lucario: tracker con % de avance, binders impresos de 360 con paneles de arte por era y placeholders con QR. El MVP debe poder reproducir esos binders en digital.

## Usuarios, casos de uso y principios

Tres perfiles principales; el MVP se diseña para el coleccionista y deja la puerta abierta al vendedor.

| Perfil | Qué quiere lograr | Casos de uso clave |
| --- | --- | --- |
| Coleccionista (showcase) | Mostrar con orgullo una colección o un master set | Armar binder temático, diseñar mosaicos, ver % de avance, compartir link |
| Vendedor de singles | Mostrar stock con precios y que le escriban | Binder de stock, precio por carta, estado vendido/reservado, contacto |
| Jugador | Guardar y mostrar mazos o su colección jugable | Pegar lista de PTCGL/Limitless y obtener un binder ordenado |
| Visitante | Hojear un binder ajeno sin cuenta | Abrir link, hojear, ver detalle de carta, copiar lista, contactar |

**Principios de producto**

1. **Lo visual manda.** Cada interacción tiene una animación con física creíble; nada salta de golpe.
2. **Fiel a lo físico.** Formatos, proporciones (63×88 mm) y comportamiento de binders reales. Lo físico es el punto de partida, no el límite.
3. **Rápido de llenar.** Importar 60 o 300 cartas debe tomar segundos, no clic por clic.
4. **Reordenar es barato.** Cualquier criterio de orden se aplica en un paso y se puede deshacer.
5. **Compartir sin fricción.** Un binder publicado se abre sin cuenta, carga rápido en móvil y tiene buena vista previa en redes.
6. **Digital ↔ físico.** Lo que se diseña en digital se puede imprimir (placeholders, paneles de arte) como ya hicimos con los PDFs.

## Glosario y modelo de dominio

Un binder es una lista de hojas; cada hoja tiene dos caras; cada cara es una grilla de bolsillos; cada bolsillo contiene una carta, un placeholder, un trozo de arte o nada.

| Término | Definición | Notas |
| --- | --- | --- |
| Binder | Contenedor con formato, apertura, tema y hojas | Estado: draft o publicado |
| Formato | Grilla por cara: filas × columnas | 2×2 (4), 3×3 (9), 4×3 (12), 4×4 (16), custom |
| Apertura | Sentido de giro de las hojas | Lateral (defecto, como libro) o vertical (como calendario) |
| Hoja (sheet) | Página física con frente y reverso | Código `S3·B·5` = hoja 3, reverso, bolsillo 5 |
| Cara (side) | Un lado de la hoja; lo que se ve al abrir | Al abrir se ven dos caras: reverso de la hoja n y frente de la n+1 |
| Bolsillo (pocket) | Celda de la grilla | Coordenada estable: hoja + cara + índice |
| Carta (card) | Impresión de catálogo: set + número + variante | Variante: normal, holo, reverse, Poké Ball, Master Ball, stamped, etc. |
| Copia (card instance) | Una carta concreta del usuario | Estado, idioma, gradeo, precio propio, notas |
| Placeholder | Ficha de una carta que falta | Estilos elegibles; incluye QR a la imagen o a la búsqueda |
| Panel de arte | Imagen que ocupa uno o varios bolsillos contiguos | Fila, par, bloque 2×2, página completa; se corta por bolsillo |
| Portada / contraportada | Panel de página completa en la primera y última cara | Opcional |
| Sección | Agrupación lógica dentro del binder | Ej.: una era o un set; puede abrir con un panel |
| Objetivo | Lista de cartas que el binder busca completar | Master set, set, mazo, lista custom; da el % de avance |
| Tema | Colores, tipografía, textura de fundas, fondo | Presets + personalización |

## Especificación funcional

Lo mínimo para el MVP está marcado con **[MVP]**; el resto entra en fases posteriores.

### 4.1 Binders

- **[MVP]** Crear, duplicar, renombrar, archivar y eliminar binders.
- **[MVP]** Estado *draft* (privado, editable) o *publicado* (versión congelada con link). Publicar crea una versión; el draft sigue editable sin afectar lo publicado.
- **[MVP]** Capacidad configurable en hojas (ej.: 20 hojas = 360 bolsillos en 3×3). Agregar o quitar hojas sin perder contenido.
- Plantillas: binder vacío, master set de una especie, set completo, stock de vendedor.
- Historial de versiones publicadas con fecha y diferencia de contenido.

### 4.2 Formatos y aperturas

- **[MVP]** Formatos estándar: 2×2 (4 bolsillos, binder chico), 3×3 (9), 4×3 (12), 4×4 (16). Formato custom filas × columnas con límite (ej.: 6×6).
- **[MVP]** Apertura lateral por defecto. Apertura vertical (tipo calendario) como opción del binder.
- Carga de bolsillo: lateral (side-loading) o superior; solo cambia la animación de inserción y el dibujo de la funda.
- Catálogo de binders "de producto": modelos reales (portafolios oficiales Pokémon, Vault X, Ultra Pro, etc.) como presets de formato + tapa + color. Se modelan como *skins* sobre un formato; las imágenes de tapa oficiales no se usan sin licencia (ver Legal).
- Vista de la tapa cerrada, giro del binder (ver lomo y contratapa) y apertura animada.

### 4.3 Contenido de un bolsillo

- **[MVP]** Carta: del catálogo, con variante. Se ve la imagen real con efectos (ver Experiencia visual).
- **[MVP]** Placeholder: para cartas que faltan. Estilos elegibles: *ficha* (como los PDFs: nombre, set, número, rareza, variante, QR), *silueta* (imagen en escala de grises + opacidad), *minimal* (número y nombre), *vacío con borde*.
- **[MVP]** Bolsillo vacío ("open slot").
- Trozo de arte: parte de un panel de arte. El panel se define una vez (imagen, recorte, zoom, posición) y se corta automáticamente en los bolsillos que cubre.
- Formas de panel: 1 bolsillo, fila, columna, par horizontal o vertical, bloque, página completa y *spread* (dos caras abiertas a la vez).
- Opción de compensar o no la costura entre bolsillos al cortar (aprendido en los PDFs: por defecto, sin compensación).
- Texto sobre paneles (título de sección, años, conteo) con tipografías del tema.

### 4.4 Edición

- **[MVP]** Arrastrar y soltar cartas entre bolsillos, caras y hojas (con auto-avance de página al arrastrar al borde).
- **[MVP]** Selección múltiple (shift/cmd, lazo) y mover o eliminar en bloque.
- **[MVP]** Deshacer/rehacer ilimitado en la sesión.
- Insertar hoja vacía en medio; "empujar" el contenido siguiente (reflow) o mantener posiciones fijas (bolsillos bloqueados).
- Bloquear bolsillos o paneles para que el reordenamiento no los mueva.

### 4.5 Ordenamiento rápido

- **[MVP]** Ordenar por: fecha de lanzamiento, set, número de carta, nombre, tipo/energía, rareza, variante, precio, fecha de adquisición, estado (tengo/me falta), custom.
- **[MVP]** Orden compuesto (ej.: era → set → número → variante) y dirección asc/desc.
- Agrupar en secciones al ordenar (una sección por era o por set) con opción de "empezar cada sección en cara nueva" y panel de apertura.
- Vista previa animada del reordenamiento antes de aplicar; aplicar es una sola acción deshacible.
- Orden custom guardado como preset reutilizable.

### 4.6 Objetivos y tracking

- **[MVP]** Asociar un objetivo al binder: master set de una o varias especies, set completo, lista importada o lista manual.
- **[MVP]** % de avance total, por sección y por tipo (base, reverse/patrones, promos), y valor conseguido vs. valor total.
- Lista "me faltan" exportable y ordenable por precio, para salir a comprar.
- Reglas de master set configurables: incluir o no reverse holos, patrones Poké Ball/Master Ball, promos, jumbos, idiomas.

### 4.7 Valorización

- **[MVP]** Precio por carta desde una fuente de mercado (ver Datos externos) y precio manual del dueño, con indicación de cuál se muestra.
- Valor total del binder, del objetivo y de lo que falta. Moneda configurable (USD, CLP, EUR) con tipo de cambio diario.
- Precio por estado (NM, LP, MP…) y por gradeo (PSA, BGS, CGC) cuando la fuente lo permita.
- Historial de precio por carta (gráfico) en fases posteriores.

### 4.8 Compartir

- **[MVP]** Link público o no listado por binder publicado; abre sin cuenta.
- **[MVP]** Vista previa en redes (imagen Open Graph generada con la portada o la primera cara).
- Modo vendedor: precio visible por carta, estados disponible/reservado/vendido, botón de contacto (WhatsApp, Instagram, correo) y "copiar lista de lo que quiero" para el comprador.
- Insertar binder en otra web (iframe) y QR del binder para eventos o tiendas.
- Exportar a PDF imprimible (placeholders + paneles, como los PDFs actuales) y a imagen por cara.

## Experiencia visual

Es factible lograr cartas con holo y relieve convincentes en el navegador, pero no con la calidad de Pokémon TCG Live: sus assets internos (capas de foil, máscaras y texturas por carta) no son públicos. La estrategia es empezar con efectos por tipo de rareza y subir la fidelidad por niveles.

### 5.1 Render de cartas por niveles

| Nivel | Técnica | Qué se logra | Costo |
| --- | --- | --- | --- |
| N1 | Imagen plana + sombra + brillo especular que sigue al puntero | Carta "física" con reflejo | Bajo |
| N2 | CSS: transform 3D, gradientes, `mix-blend-mode`, filtros, máscaras por rareza | Holo, reverse, cosmos, rainbow, galaxy por tipo de rareza | Medio |
| N3 | WebGL (three.js / react-three-fiber): shader con normal map + capa de foil | Relieve (texturas de full art, letras grabadas), iridiscencia real con luz | Alto |
| N4 | Máscaras de foil por carta (hechas a mano o con IA) | Holo solo en la zona correcta (ilustración vs. marco), como la carta real | Muy alto, escalable con comunidad |

- Referencia técnica para N2: [pokemon-cards-css](https://github.com/simeydotme/pokemon-cards-css) de simeydotme. Usa transforms, gradientes, blend-modes y filtros para simular los foils. **Licencia GPL-3.0**: estudiar la técnica, no copiar el código, o el proyecto entero queda obligado a GPL.
- El efecto por defecto se elige por **rareza + variante** del catálogo (ej.: Reverse Holo → foil en el marco; Special Illustration Rare → textura + iridiscencia en toda la carta).
- Interacción: inclinación con puntero o giroscopio (móvil, con permiso); al soltar, la carta vuelve a su lugar con resorte.
- Calidad de imagen: las imágenes públicas de catálogo rondan 734×1024 px (ver Datos externos). Para zoom grande, ampliar con un modelo de super-resolución en el backend y cachear (ya probado en este proyecto con Real-ESRGAN anime).

### 5.2 Animaciones

| Interacción | Comportamiento esperado | Técnica sugerida |
| --- | --- | --- |
| Pasar página (lateral) | Hoja que se curva y gira sobre el lomo; arrastre con el dedo o clic | Three.js con malla de hoja deformable, o CSS 3D + sombra dinámica |
| Pasar página (vertical) | Mismo efecto, eje horizontal (arriba) | Misma malla rotada |
| Sacar carta | La carta se desliza fuera de la funda y crece al centro | Shared layout animation (Motion) |
| Insertar carta | Entra por el lado de carga y se asienta en la funda | Motion con spring |
| Girar carta | Volteo 3D para ver el reverso | CSS 3D `rotateY` |
| Girar binder | Cerrar, ver tapa, lomo y contratapa | Escena 3D |
| Reordenar | Las cartas vuelan a su nueva posición en paralelo | FLIP con Motion `layout` |

- Objetivo: 60 fps en un teléfono de gama media. Fuera de foco, la carta usa una imagen estática liviana y los efectos se activan solo en la carta enfocada.
- Respetar `prefers-reduced-motion`: cambios de página con fundido y sin inclinación.
- Fundas: textura de plástico (brillo, leve opacidad, costuras) configurable por tema. Opción "sin fundas" para mosaicos limpios.

## Datos externos: catálogo, imágenes y precios

El catálogo es viable gratis; los precios de mercado son el punto débil y requieren una capa propia que combine fuentes. TCGplayer no entrega API a desarrolladores nuevos, así que no se puede depender de ella.

| Fuente | Qué aporta | Acceso | Uso propuesto |
| --- | --- | --- | --- |
| [pokemontcg.io](https://pokemontcg.io) | Catálogo EN, imágenes ~734×1024, códigos PTCGO, snapshot de precios TCGplayer/Cardmarket | Gratis con key; en migración a Scrydex, sin fecha de cierre anunciada | Semilla del catálogo (el dump está en GitHub: `PokemonTCG/pokemon-tcg-data`) |
| [Scrydex](https://scrydex.com/faq) | Sucesor oficial de pokemontcg.io; IDs compatibles; precios raw diarios; gradeados e historial en planes pagos; varios TCG | Planes Starter / Growth / Professional por créditos | Fuente principal de precios USD a mediano plazo |
| [TCGdex](https://tcgdex.dev) | Catálogo multilingüe (ES, JP, FR…), REST y GraphQL, open source | Gratis, sin key | Cartas en español y japonés; dump en GitHub `tcgdex/cards-database` (fase posterior, no en Fase 0/MVP) |
| JustTCG | Precios por impresión y estado, varios TCG | Free tier + planes | Alternativa o respaldo de precios por condición |
| PriceCharting | Precios por ventas cerradas, incluye gradeadas PSA/BGS/CGC | Suscripción paga | Valor de cartas gradeadas (fase posterior) |
| TCGplayer | Mercado de referencia en EE.UU. | API cerrada a nuevos desarrolladores | Solo enlaces de búsqueda / afiliado, nunca datos por API |
| Cardmarket | Mercado de referencia en Europa | API con aprobación; no confirmado para apps nuevas | Enlaces; precios EUR vía snapshot de pokemontcg.io mientras exista |
| TCGMatch (Chile) | Mercado local | No encontré API pública | Enlace manual; conversar alianza si el producto crece en Chile |
| Dueño del binder | Precio propio por copia | Siempre disponible | Prioridad en modo vendedor |

**Decisiones de arquitectura de datos**

- Catálogo propio en base de datos, sembrado desde los dumps de GitHub y actualizado con un job semanal. La app nunca consulta APIs externas en el request del usuario.
- Imágenes cacheadas en un storage propio + CDN, con derivados (miniatura, mediana, alta, alta ampliada con IA). Revisar términos de cada fuente antes de re-servir imágenes.
- Precios en una tabla `price_points` (fuente, carta, variante, condición, moneda, valor, fecha). Job diario. La UI muestra la fuente y la fecha de cada precio.
- Identidad de carta independiente del proveedor: id interno + tabla de mapeo a ids externos (pokemontcg.io, TCGdex, Scrydex, código PTCGO).

No vi el estado de Cardmarket ni el detalle de precios de los planes de Scrydex y JustTCG; quedan como preguntas abiertas antes de elegir proveedor de precios. Fuentes: [CardGrader — TCGplayer API Alternatives (2026)](https://cardgrader.ai/blog/tcgplayer-api-alternatives), [Scrydex FAQ](https://scrydex.com/faq).

## Importación masiva

Copiar un mazo desde Pokémon TCG Live o Limitless y pegarlo en un binder es factible: el texto exportado sigue el patrón `cantidad nombre CÓDIGO_SET número`, y el catálogo trae el código PTCGO de cada set para resolverlo.

```
Pokémon: 12
4 Riolu MEG 76
3 Mega Lucario ex MEG 77
...
Trainer: 36
4 Boss's Orders BRS 132
...
Energy: 12
8 Basic {F} Energy SVE 6
```

**Formatos de entrada**

| Entrada | Ejemplo | Resolución |
| --- | --- | --- |
| Lista PTCGL / Limitless | `4 Riolu MEG 76` | Set por código PTCGO + número; encabezados "Pokémon/Trainer/Energy" se ignoran |
| Códigos ALT de PTCGL | `1 Boss's Orders SWSHALT 127` | Tabla de mapeo ALT → impresión real; si no existe, buscar por nombre y pedir confirmación |
| Set completo | "Mega Evolution, todas las variantes" | Desde el catálogo, con reglas de variantes del master set |
| Master set de especie | "Zorua + Zoroark, EN" | Búsqueda por especie y evoluciones, igual al tracker actual |
| CSV / planilla | `name,set,number,variant,qty,price` | Columnas mapeables; exportaciones de Collectr, Dex, TCGplayer como presets |
| Texto libre / foto | "Pikachu 25/102 base" o foto de binder | Fase posterior: coincidencia difusa y reconocimiento por imagen |

**Flujo de importación**

1. Pegar o subir.
2. Ver tabla de resultados: resueltas, ambiguas (elegir impresión con miniaturas) y no encontradas.
3. Elegir destino: al final, desde un bolsillo concreto o en una sección nueva.
4. Elegir modo: "una copia por carta" o "todas las copias" (4 Riolu = 4 bolsillos o 1 bolsillo con ×4).
5. Aplicar con animación de llenado y opción de deshacer.

**Exportar** es el camino inverso: copiar lista en formato PTCGL, CSV, o lista "me faltan" para enviar a una tienda.

Fuente del formato y de los códigos ALT: [Limitless — Decklist Submission](https://docs.limitlesstcg.com/player/decklists).

## Arquitectura técnica y stack

Propuesta: monorepo TypeScript con Next.js para la web, un núcleo de dominio puro y testeable, y workers separados para ingesta de datos y procesamiento de imágenes. Es una propuesta; las alternativas se discuten en Decisiones abiertas.

| Capa | Elección | Por qué / salida si hay que migrar |
| --- | --- | --- |
| Web | Next.js (App Router) + React + TypeScript, empaquetado como contenedor Docker (`output: standalone`) | Corre igual en Railway, Fly, Render o un VPS: se mueve con un `docker run` |
| Hosting | Railway (plan actual del dueño): servicio web + Postgres en el mismo proyecto | Sin costo extra al inicio; nada específico de Railway en el código |
| Estado del editor | Zustand + historial propio (undo/redo con parches) | Simple; el binder es un documento |
| Drag & drop | dnd-kit | Accesible, teclado y táctil |
| Animación UI | Motion (ex Framer Motion) | Springs, `layout` y shared layout |
| 3D y shaders | react-three-fiber + drei | Curvatura de página, giro del binder, holo con normal maps |
| Base de datos | Postgres estándar + Drizzle ORM, sin extensiones propietarias | Se migra con `pg_dump` / `pg_restore` a Neon, Supabase o cualquier Postgres |
| Auth | Better Auth (librería open source) con sus tablas en nuestro Postgres | Sin proveedor externo de identidad que retenga usuarios; Google + correo |
| Archivos | Cloudflare R2 vía API S3 (SDK de AWS) | 10 GB y egreso gratis; se cambia a cualquier S3 cambiando variables de entorno |
| DNS, dominio y CDN | Cloudflare | Dominio a precio de costo; CDN delante de R2 y de la web |
| Jobs programados | GitHub Actions con `schedule` (ingesta de catálogo y precios) | Gratis en repo público o dentro de los minutos del plan; scripts Node normales, ejecutables en cualquier cron |
| Imágenes pesadas | Script Python (Real-ESRGAN) ejecutado bajo demanda (local o Actions) | Sin servidor con GPU encendido |
| PDF imprimible | Script que reusa el pipeline actual (reportlab) | Paridad con los PDFs de los binders actuales |
| Tests | Vitest (núcleo) + Playwright (flujos y capturas) | Cobertura alta en layout y ordenamiento |

**Estructura del repo**

```
apps/web              Next.js: editor, visor público, cuenta
packages/binder-core  Dominio puro: formatos, hojas/caras/bolsillos, paneles, ordenamiento, reflow, códigos S·F/B·n
packages/catalog      Tipos de carta, resolución de listas (PTCGL, CSV), reglas de master set
packages/card-render  Componentes de carta: imagen, holo CSS (N2), shader WebGL (N3)
packages/ui           Sistema de diseño y temas
workers/ingest        Catálogo (pokemontcg.io, TCGdex) y precios
workers/media         Derivados de imagen, upscaling, OG, PDF
```

**Reglas de arquitectura**

- `binder-core` no importa React ni nada de red: recibe datos y devuelve datos. Ahí viven el reflow, el corte de paneles por bolsillo y el ordenamiento.
- El layout de un binder se guarda como documento versionado (JSONB) y se valida con un esquema (Zod). Publicar = copiar la versión.
- El visor público no carga el editor: bundle separado, imágenes progresivas y efectos solo en la carta enfocada.

*(Diagrama de arquitectura pendiente de incorporar: clientes → app → datos y workers. Los clientes solo hablan con la app; los datos externos entran por el worker de ingesta y las imágenes procesadas por el worker de medios.)*

## Modelo de datos

El catálogo y los precios son tablas relacionales; el contenido de cada binder es un documento versionado que apunta a ellas por id.

| Entidad | Campos principales | Notas |
| --- | --- | --- |
| `game` | id, nombre | `pokemon` primero; abre la puerta a otros TCG |
| `set` | id, game_id, nombre, serie/era, fecha, total impreso, código PTCGO, idioma | Era = agrupación para ordenar y seccionar |
| `card` | id, set_id, número, nombre, especie(s), supertipo, tipos, rareza, ilustrador, idioma | Una carta impresa, sin variante |
| `card_variant` | id, card_id, variante (normal, holo, reverse, pokeball, masterball, stamped…), efecto de render, imágenes | Unidad que va a un bolsillo y que se valoriza |
| `external_id` | entidad, proveedor, id externo | Mapeo a pokemontcg.io, TCGdex, Scrydex, PTCGO, ALT |
| `price_point` | variant_id, fuente, condición, gradeo, moneda, valor, fecha | Histórico; la UI usa el último por fuente |
| `user` | id, nombre, handle, moneda preferida | Handle para URL pública |
| `card_instance` | id, user_id, variant_id, estado, idioma, gradeo, precio propio, notas, fecha de adquisición | Inventario real; un binder puede referenciar copias o solo variantes |
| `binder` | id, user_id, nombre, formato (filas, columnas), apertura, carga, hojas, tema, objetivo, estado | Metadatos |
| `binder_version` | id, binder_id, número, layout (JSONB), creado, publicado | Draft = última versión no publicada |
| `art_asset` | id, user_id, archivo, ancho, alto, origen, licencia/crédito | Imágenes subidas o del banco de arte |
| `goal` | id, tipo (master set, set, lista), reglas, lista de variant_ids | Calcula el % de avance |
| `share_link` | id, binder_id, slug, visibilidad, vistas | Público o no listado |

**Layout del binder (JSONB, validado con Zod)**

```json
{
  "format": { "rows": 3, "cols": 3 },
  "opening": "side",
  "sheets": 20,
  "theme": { "preset": "night-crimson", "sleeve": "clear", "bg": "asset_123" },
  "sections": [{ "id": "bw", "title": "Black & White", "startsOnNewSide": true }],
  "panels": [{ "id": "p1", "asset": "asset_77", "anchor": "S1·F·1", "span": { "rows": 3, "cols": 3 }, "crop": { "x": 0, "y": 0, "zoom": 1 }, "seamMm": 0 }],
  "pockets": {
    "S1·B·1": { "kind": "card", "variant": "sv1-112.normal", "instance": null, "locked": false },
    "S1·B·2": { "kind": "placeholder", "variant": "bw1-70.reverse", "style": "ficha" },
    "S1·B·3": { "kind": "empty" }
  }
}
```

- Los bolsillos se direccionan con el mismo código de los PDFs (`S3·B·5`): hoja, cara (F/B) e índice en orden de lectura.
- Un panel se guarda una vez con su ancla y su tamaño; los bolsillos que cubre se derivan, no se duplican.
- El tracker actual se migra así: los 267 ítems de los master sets se convierten en `card_variant` + un `goal` por familia, y los códigos de bolsillo de los PDFs se importan como layout inicial.

## Requisitos no funcionales

El visor público es lo más exigente: tiene que verse espectacular y cargar rápido en un teléfono con datos móviles.

| Área | Requisito | Medida |
| --- | --- | --- |
| Carga | Primera cara visible en móvil 4G | LCP < 2,5 s; imágenes progresivas; precarga de la cara siguiente |
| Fluidez | Animaciones de página y carta | 60 fps en gama media; máximo 1 carta con shader activo a la vez |
| Escala | Binder grande | 360 bolsillos en 3×3 y 640 en 4×4 sin degradar el editor |
| Disponibilidad de datos | Precios | Cada precio muestra fuente y fecha; si la fuente falla, se mantiene el último valor |
| Accesibilidad | Teclado y lector de pantalla | WCAG 2.1 AA; mover cartas con teclado; `prefers-reduced-motion` |
| Idioma | Interfaz | Español e inglés desde el inicio (i18n); cartas en su idioma de impresión |
| Moneda | Precios | USD base; CLP y EUR con tipo de cambio diario |
| Privacidad | Datos del usuario | Binders draft privados; contacto del vendedor solo si lo publica |

**Legal y propiedad intelectual (revisar antes de lanzar)**

- Pokémon, sus imágenes y logos son de Nintendo / Creatures / GAME FREAK / The Pokémon Company. El sitio debe declararse no oficial y no usar logos ni marcas en su nombre o identidad.
- Mostrar imágenes de cartas para identificar productos es práctica común en la industria, pero no es una licencia. Revisar los términos de cada API sobre re-servir imágenes.
- El arte que suben los usuarios es responsabilidad de ellos: términos de uso, crédito al ilustrador en paneles, y canal para retirar contenido.
- Las tapas de binders oficiales (Pokémon, Ultra Pro, Vault X) no se reproducen sin licencia; se ofrecen formatos y colores equivalentes.
- Si se usa código GPL (ej.: pokemon-cards-css), todo el proyecto queda bajo GPL. Recomendación: implementación propia inspirada en la técnica.

## Ideas adicionales de valor

Las ideas con más potencial son las que conectan el binder digital con el físico y con otras personas: impresión, intercambio y descubrimiento.

| Idea | Para quién | Valor |
| --- | --- | --- |
| Imprimir el binder (placeholders + paneles de arte en PDF) | Coleccionista | Ya probado; nadie más lo ofrece integrado al diseño digital |
| Lista de deseos + coincidencias de intercambio | Coleccionistas | "Tengo repetida lo que te falta": cruza binders públicos de la comunidad |
| Modo tienda con múltiples binders y catálogo unificado | Vendedores | Un link de tienda con búsqueda sobre todos sus binders de stock |
| Alertas de precio y de reimpresión | Coleccionistas | Avisar cuando una carta que falta baja de un umbral o sale un set con la especie |
| Agregar cartas nuevas al objetivo automáticamente | Coleccionistas de especie | Cada set nuevo con Lucario se suma al master set y abre un "espacio libre" |
| Escaneo con cámara para cargar cartas | Todos | Identificar por imagen (API externa o modelo propio); muy pedido en apps de colección |
| Galería pública y binders destacados | Comunidad | Descubrimiento; binders temáticos (por ilustrador, por color, por especie) |
| Plantillas de diseño compartibles | Comunidad | Un mosaico o tema creado por alguien se reutiliza en otros binders |
| Binders colaborativos | Grupos, ligas, tiendas | Varios editores en un binder (ej.: colección de un club) |
| Modo presentación / stream | Creadores de contenido | Hojear el binder a pantalla completa para videos y streams de aperturas |
| Insignias de avance | Coleccionistas | "Master set completo", "100% Black & White": compartibles en redes |
| Estadísticas de colección | Todos | Valor en el tiempo, gasto, distribución por era, ilustradores favoritos |
| Banco de arte con crédito | Diseñadores | Paisajes generados (como los de los PDFs) y arte de la comunidad con licencia clara |
| Soporte LATAM | Mercado local | CLP, español, tiendas y eventos locales (ej.: Trading Fest Chile) |

## Roadmap y tracking

Seis fases; cada una termina con algo usable. La fase 1 tiene que poder reproducir los dos binders de Zoroark y Lucario. Marca las tareas aquí a medida que avanzan.

### Fase 0 — Fundaciones

- [x] Monorepo (pnpm + Turborepo), lint, CI, Vitest y Playwright
- [x] Base de datos y migraciones (Drizzle) con las tablas del Modelo de datos
- [x] Ingesta del catálogo EN desde `pokemon-tcg-data` (ES/JP vía TCGdex queda para una fase posterior)
- [x] Pipeline de imágenes: copia a R2, derivados por tamaño, CDN
- [x] `binder-core`: formatos, códigos `S·F/B·n`, reflow, corte de paneles, con tests

### Fase 1 — MVP: editor, visor y tracking

- [x] Crear binder: formato 2×2/3×3/4×3/4×4, hojas, apertura lateral/vertical
- [x] Editor de caras: agregar carta por búsqueda, placeholder, vacío; drag & drop; selección múltiple; undo/redo (sin drag de grupo, lasso ni auto-avance de página — ver registro de decisiones)
- [x] Importar lista PTCGL/Limitless y CSV con resolución de ambiguas (sin códigos ALT ni texto libre/foto — ver registro)
- [x] Ordenamiento compuesto (era, set, número, variante, rareza) con agrupado y secciones (sin precio/custom como criterio ni encabezados de sección persistentes — ver registro)
- [x] Objetivo master set por especie con % de avance y "me faltan"
- [x] Precios snapshot (pokemontcg.io, tcgplayer) + precio manual; solo USD (CLP/EUR queda pendiente — ver registro)
- [x] Draft y publicado; link público sin cuenta; imagen Open Graph
- [x] Migrar el tracker actual (267 cartas, 2 objetivos, códigos de bolsillo)

### Fase 2 — Experiencia visual

- [x] Holo por rareza y variante (nivel N2) con inclinación por puntero (sin giroscopio en mobile ni heurística por texto de rareza — ver registro)
- [x] Pasar página con curvatura 3D (lateral y vertical) (sin swipe táctil, solo click y teclado — ver registro)
- [x] Sacar, insertar y voltear carta; girar binder (reverso propio Sleevebook, girar en CSS 3D, insertar solo al asignar desde la búsqueda — ver registro)
- [x] Paneles de arte (fila, par, bloque, página completa) con recorte y zoom (sin spread entre dos caras, solo URL pegada — ver registro)
- [x] Temas: colores, fondos, textura de fundas (portadas resueltas como panel de página completa, ver registro)
- [x] Reordenamiento animado (FLIP) (solo en "Aplicar orden" — ver registro)

### Fase 3 — Vendedores y salida física

- [ ] Modo vendedor: precios visibles, estados, contacto, carrito "copiar lista"
- [ ] Exportar a PDF imprimible (placeholders + paneles) y a imagen por cara
- [ ] Embed (iframe) y QR del binder
- [ ] Proveedor de precios principal elegido (Scrydex o JustTCG) con job diario

### Fase 4 — Comunidad

- [ ] Lista de deseos y coincidencias de intercambio
- [ ] Galería pública, destacados y plantillas compartibles
- [ ] Alertas de precio y de sets nuevos con la especie

### Fase 5 — Fidelidad y alcance

- [ ] Holo con WebGL y relieve (N3); máscaras de foil por carta (N4)
- [ ] Escaneo de cartas con cámara
- [ ] Segundo TCG (One Piece o Lorcana)

## Decisiones abiertas y registro

Alcance, backend y hosting quedaron decididos el 13-10-2026; antes del primer link público solo falta el nombre.

**Abiertas**

| # | Pregunta | Opciones | Estado |
| --- | --- | --- | --- |
| 1 | Nombre y dominio | Sleevebook, Holosleeve, Pagefoil, Foiltheca (.com libres al 13-10-2026); otros con .app | Decidido: Sleevebook |
| 2 | Proveedor de precios | Snapshot pokemontcg.io / Scrydex / JustTCG | Snapshot en MVP; comparar planes en fase 3 |
| 3 | Monetización | Gratis / freemium (modo tienda, PDF) / afiliados | Decidir después de la beta |
| 4 | Motor 3D de página | CSS 3D / three.js | Decidido: CSS 3D (2026-10-16). Medido con CPU 4× más lenta, viewport 412 px, build dev: pasar página 57 fps, abrir binder 60, sacar carta 58, voltear 60; un solo frame largo (≤67 ms) al montar la animación. three.js queda para N3 (relieve/WebGL), no para la página |
| 5 | Inventario | Binder referencia variantes / copias reales | Variantes en MVP; copias en modo vendedor |
| 6 | Base de datos si Railway queda corto | Postgres en Railway / Neon free | Railway mientras el uso quepa en el plan |

**Registro de decisiones**

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-13 | Producto para la comunidad desde el día 0, lanzado como beta cerrada a conocidos | Cuentas y binders públicos desde el inicio, sin marketing |
| 2026-10-13 | Infraestructura de costo mínimo y portátil: Docker + Postgres estándar + S3 + Better Auth | No depender de un free trial ni de servicios propietarios que obliguen a migrar |
| 2026-10-13 | Hosting en Railway (plan existente), DNS y dominio en Cloudflare, archivos en R2 | Reusa lo que ya se paga; R2 sin costo de egreso |
| 2026-10-13 | Jobs programados en GitHub Actions | Gratis y portátil (scripts normales) |
| 2026-10-13 | Primer TCG: Pokémon, cartas en inglés | Colección propia y catálogo más completo |
| 2026-10-13 | Paneles de arte se cortan sin compensar costura | Las piezas deben calzar al ponerlas lado a lado |
| 2026-10-13 | Código de bolsillo `S·F/B·n` como identificador estable | Ya impreso en los PDFs; une digital y físico |
| 2026-10-13 | Textos de binders impresos en inglés; interfaz en español e inglés | Cartas en inglés; usuario hispanohablante |
| 2026-10-13 | No usar arte que ya aparece en cartas para paneles | Que el binder sume arte nuevo, no repita |
| 2026-10-13 | Nombre del producto: Sleevebook (sleevebook.com y .app libres al 13-10-2026) | Claro, bilingüe, evoca el binder como libro de fundas |
| 2026-10-13 | Desplegar en Railway; gasto sobre el plan permitido solo con límite de uso y alertas configuradas | Usar lo que ya se paga sin sorpresas en la factura |
| 2026-10-13 | Fase 0 y MVP solo con catálogo e interfaz en inglés (ES/JP vía TCGdex pasa a fase posterior) | Enfocar el primer tramo del proyecto; el modelo de datos ya queda abierto a más idiomas sin rehacerlo |
| 2026-10-13 | Pipeline de imágenes (R2 + derivados) entra en Fase 0, dentro de la sesión de arranque | El usuario decidió incluirlo ya en vez de posponerlo a Fase 1 |
| 2026-10-13 | `card_variant` gana la columna `needs_review` (boolean) | Hacer visible en la base, no solo en logs, qué variantes inferidas por la ingesta requieren confirmación manual (sets muy recientes o rareza desconocida) |
| 2026-10-13 | Resolución de módulos del repo: `module`/`moduleResolution` tipo "Bundler" en vez de "NodeNext"; sin extensión `.js` en imports relativos | Turbopack (usado por `apps/web`) no soporta el mapeo `.js`→`.ts` que sí soporta webpack; "Bundler" funciona igual para tsc, vitest y tsx |
| 2026-10-13 | No se escribe `railway.json` en el repo | Config as Code de Railway está deprecado y los servicios nuevos ya no pueden usarlo; el build usa autodetección del `Dockerfile` en la raíz y el resto (healthcheck, restart policy, pre-deploy) se configura en el dashboard — ver `docs/DEPLOY.md` |
| 2026-10-13 | Las migraciones en producción corren con el migrator de `drizzle-orm` (no `drizzle-kit`) vía `packages/db/src/migrate-cli.ts` | `drizzle-kit` es dependencia de desarrollo; el runtime de producción no debe necesitarla |
| 2026-10-13 | Fase 0 y MVP solo con catálogo e interfaz en inglés (ES/JP vía TCGdex pasa a fase posterior) | Enfocar el primer tramo del proyecto; el modelo de datos ya queda abierto a más idiomas sin rehacerlo |
| 2026-10-13/14 | Login real (Better Auth) queda para más adelante; toda la Fase 1 usa `DEV_USER_ID`/`ensureDevUser`, un seam centralizado de "usuario actual" | Pedido explícito del usuario al arrancar la fase, para que enchufar auth real después no implique rehacer binders/goals/share |
| 2026-10-14 | Editor de caras sin drag de grupo, lasso ni auto-avance de página al arrastrar al borde | El usuario aprobó recortar las 3 sub-features más caras de drag & drop vía pregunta directa; dnd-kit permite agregarlas después sin rehacer la base |
| 2026-10-14 | Orden compuesto sin precio/fecha de adquisición/estado/tipo de energía como criterio, sin preview animado, sin presets guardados, sin encabezados de sección persistentes en el visor | Precio/fecha/estado viven en `card_instance`, todavía no conectado a los bolsillos; encabezados de sección necesitarían conectar el campo `sections` del layout (hoy sin uso) a algo que los ancle a un rango de bolsillos |
| 2026-10-14 | Importación de listas sin códigos ALT de PTCGL, sin "set completo"/"master set" como entrada (ya se resuelve vía Goals), sin texto libre/foto, y solo por texto pegado (sin subir archivo, ni para CSV) | El usuario aprobó el recorte vía pregunta directa; códigos ALT necesitan una tabla de mapeo que no existe; texto libre/foto está marcado en la spec como fase posterior |
| 2026-10-14 | Precios: solo snapshot de tcgplayer (USD) ya embebido en el dump de pokemontcg.io; sin CLP/EUR con tipo de cambio diario, sin precio por estado/gradeo, sin historial con gráfico | Ninguno de estos está marcado [MVP] en la spec; el historial con gráfico la spec lo marca explícitamente como fase posterior; Scrydex/JustTCG/PriceCharting quedan como pregunta abierta (ver tabla de Datos externos) |
| 2026-10-14 | Publicar un binder no congela una versión inmutable: la página pública (`/s/[slug]`) muestra el layout en vivo, igual que la vista del dueño, no una copia fijada al momento de publicar | La nota de arquitectura "Publicar = copiar la versión" implicaría que `pocket-actions.ts`/`sort-actions.ts`/`import-actions.ts` dejen de pisar la única fila de `binder_version` y empiecen a insertar versiones nuevas; ese refactor quedó fuera de alcance del bloque. Efecto: editar después de publicar se ve al instante en el link público, sin "republicar" |
| 2026-10-14 | Compartir sin modo vendedor (precio visible, estados disponible/reservado/vendido, contacto), sin iframe+QR, sin exportar PDF/imagen | El usuario aprobó cortar las 3 vía pregunta directa; ninguna está marcada [MVP] en la spec |
| 2026-10-14 | Holo/foil (Fase 2, bloque 1): efecto dirigido solo por `card_variant.variant`, sin heurística de rareza (rainbow/cosmos/galaxy) por texto; sin tilt por giroscopio en mobile, solo pointer/touch move | Rareza en texto es inconsistente entre sets/eras; giroscopio necesitaría un flujo de permiso de `DeviceOrientation`. Ambos recortes aprobados por el usuario vía pregunta directa |
| 2026-10-14 | Temas (Fase 2, bloque 2): portada/contraportada se posponen al bloque de paneles de arte, no se implementan como feature aparte | Una portada es en realidad un panel de página completa; necesita la infraestructura de upload+recorte/zoom que construye ese bloque. Confirmado con el usuario vía pregunta directa |
| 2026-10-14 | Paneles de arte (Fase 2, bloque 3): imágenes solo por URL pegada (sin subida a R2); sin paneles que crucen dos caras (spread); sin overlay de texto sobre el panel | Subida a R2 implicaría agregar credenciales S3 y una ruta API por primera vez en `apps/web`, un salto mayor al que ameritaba el bloque; `Panel`/`coveredPockets` de binder-core hoy solo soporta spans dentro de una cara; overlay de texto queda como pulido posterior. Los 3 recortes aprobados por el usuario vía pregunta directa |
| 2026-10-14 | Reordenamiento animado FLIP (Fase 2, bloque 4): animación real (shared-element "flying card") solo en "Aplicar orden"; drag & drop, importar y deshacer/rehacer siguen con el snap instantáneo de siempre, sin animación especial | El usuario eligió esta opción vía pregunta directa; "Aplicar orden" es el caso con más movimientos simultáneos y el que más se beneficia de ver a dónde va cada carta, mientras que drag&drop ya tiene feedback visual inmediato del propio gesto |
| 2026-10-14 | Pasar página con curvatura 3D (Fase 2, bloque 5): el visor (propio y público `/s/[slug]`) pasó de paginar vía Server Component + `?spread=N` (navegación completa por click) a cargar el binder completo una sola vez y paginar 100% client-side; el giro es una curvatura real de dos segmentos (plano "fijo" cerca del lomo + "punta" que se curva más, en 3D con `rotateY`/`rotateX` según `opening`), no un flip rígido; sin gesto de swipe táctil, solo click y flechas de teclado | El usuario eligió expresamente la curvatura real (más costosa) y descartó el flip rígido recomendado, y pidió mantener el swipe fuera de alcance; la paginación se movió a client-side porque animar con fiabilidad exige que ambos spreads (saliente y entrante) estén ya en memoria — depender del tiempo real de red de una navegación de servidor habría hecho que la animación a veces no se viera o parpadeara |
| 2026-10-16 | Sacar/insertar/voltear carta y girar binder (Fase 2, bloque 6): "sacar" es un FLIP medido (no `layoutId`) desde el bolsillo al centro y de vuelta; "voltear" usa un reverso original de Sleevebook (no el dorso oficial Pokémon) y vive dentro de la carta enfocada (botón o tecla F); "insertar" anima solo al asignar una carta desde la búsqueda del editor (drag & drop, deshacer, importar y ordenar no la reproducen); "girar binder" es una caja CSS 3D (sin three.js) con tapa, lomo y contratapa, que aparece al entrar a un binder sin `?spread` y se abre con animación; la tapa usa como arte un panel de página completa anclado en `S1·F·1` | Reverso, motor CSS 3D y alcance aprobados por el usuario vía pregunta directa; el dorso oficial es arte con copyright (ver Legal); `?spread=N` sigue abriendo directo para no romper links ni marcadores; FLIP medido evita colisiones de `layoutId` con la copia fantasma del pasar página |
| 2026-10-16 | Design brief aplicado antes de cerrar Fase 2 ("ola 4"): tokens y fuentes (Instrument Serif / Hanken Grotesk / Geist Mono vía `next/font`) en `globals.css`; el preset `default` pasa a "Galería" (terciopelo/lino/foil) y el blanco anterior queda como `clasico`; restyle de landing, lista de binders, crear, "me faltan", portada pública, cabecera con cifras de catálogo, binder abierto sobre cuero, detalle de carta con ficha y editor como mesa de trabajo | El usuario pidió aplicar `docs/DESIGN_BRIEF.md` antes del punto de control humano. No se muestra precio ni fecha en el detalle de carta (el visor no recibe precios por carta) ni el dueño en la portada pública (la consulta de share no lo trae); la landing usa las imágenes de demo de pokemontcg.io, igual que `/demo` |
| 2026-10-16 | Pasar página = una hoja que gira sobre el lomo: el frente sale de la cara derecha (o izquierda hacia atrás) y su reverso aterriza exacto sobre la cara opuesta, con el borde libre adelantado a mitad de giro. Todo spread tiene dos posiciones fijas: el primero y el último muestran la contratapa interior frente a su única cara (en móvil se oculta) | En la revisión funcional el pliegue anterior giraba el spread completo desde el borde exterior y se detenía a 130°, así que no partía ni terminaba donde debía. Se mide la posición real de cada cara antes de pintar, así el giro sirve para apertura lateral, superior y móvil apilado; la landing usa el mismo componente |
