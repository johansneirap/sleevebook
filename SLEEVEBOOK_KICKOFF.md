# Sleevebook — sesión de arranque (Fase 0)

> Pega este archivo completo como primer mensaje en una sesión nueva de Claude Code, desde una carpeta vacía donde vivirá el repo.
> Junto a él, guarda el documento de producto exportado a Markdown en `docs/PRODUCT.md` (desde el doc "Sleevebook — documento de producto": exportar → Markdown).

---

## 1. Tu rol y cómo trabajamos

Eres el ingeniero principal de **Sleevebook**. Yo (Johans) soy el dueño del producto y desarrollador fullstack con experiencia en React/TypeScript.

- Comunícate conmigo en **español**. Código, nombres, comentarios y commits en **inglés**.
- `docs/PRODUCT.md` es la fuente de verdad. Si algo no está ahí ni en este archivo, **pregúntame antes de inventarlo**.
- Antes de escribir código en cada bloque de trabajo, propón un plan corto (archivos, tipos, tests) y espera mi visto bueno.
- Trabaja en pasos pequeños y verificables: cada paso termina con tests en verde y un commit.
- Al cerrar la sesión, entrégame: qué casillas del Roadmap de `docs/PRODUCT.md` se pueden marcar, qué decisiones nuevas van al registro y qué quedó pendiente.

## 2. Qué es Sleevebook (resumen)

Una web para crear **binders digitales de cartas TCG** (Pokémon primero) que:

1. Se ven y se comportan como binders físicos: formatos 2×2, 3×3, 4×3, 4×4 y custom; apertura lateral (defecto) o vertical; hojas con frente y reverso; animaciones de página y de carta.
2. Funcionan como lienzo de diseño: cada bolsillo contiene una **carta**, un **placeholder**, un **trozo de arte** (paneles que cruzan varios bolsillos: fila, par, bloque, página completa) o queda **vacío**.
3. Tienen datos vivos: catálogo de cartas, precios de mercado, objetivos tipo master set con % de avance.
4. Se comparten con un link (beta cerrada a conocidos al inicio, pero pensado para la comunidad desde el día 0).

Origen real: dos master sets (Zorua/Zoroark y Riolu/Lucario) con tracker web y binders impresos de 360 bolsillos con paneles de arte por era. La Fase 1 debe poder reproducir esos binders en digital.

## 3. Decisiones ya tomadas (no las reabras sin preguntar)

| Tema | Decisión |
|---|---|
| Alcance | Producto para la comunidad, lanzado como beta cerrada |
| Primer TCG | Pokémon, cartas en inglés (modelo abierto a otros idiomas y TCG) |
| Hosting | **Railway** (plan existente). Web y Postgres en el mismo proyecto |
| Presupuesto | Lo más barato posible. Se acepta pasar el plan solo con **límite de uso y alertas** configurados |
| Portabilidad | Nada propietario: Docker + Postgres estándar + S3 + auth propia. Migrar = cambiar variables de entorno |
| Base de datos | Postgres estándar + Drizzle ORM, sin extensiones propietarias |
| Auth | Better Auth (open source), tablas en nuestro Postgres. Google + correo |
| Archivos | Cloudflare R2 vía API S3 (`@aws-sdk/client-s3`) |
| Dominio, DNS, CDN | Cloudflare (`sleevebook.com`) |
| Jobs programados | GitHub Actions con `schedule` (scripts Node normales) |
| Identificador de bolsillo | Código `S{hoja}·{F|B}·{n}` (ej. `S3·B·5` = hoja 3, reverso, bolsillo 5). Alias ASCII para URLs: `s3-b-5` |
| Paneles de arte | Se cortan por bolsillo **sin compensar costura** por defecto (`seamMm: 0`) |
| Licencias | Nada de código GPL (ej. `pokemon-cards-css` es GPL-3.0: solo referencia de técnica) |

## 4. Stack

- **Node 22 LTS**, **pnpm** workspaces + **Turborepo**, **TypeScript** en modo `strict`.
- **Next.js** (App Router) con `output: "standalone"` para Docker.
- **Zod** para validar el layout del binder y la entrada de las APIs.
- **Drizzle ORM** + `drizzle-kit` para migraciones; `postgres` (driver) como cliente.
- **Vitest** para paquetes; **Playwright** para flujos web.
- Lint/format: **Biome** (un solo binario, rápido).
- Más adelante (no en esta sesión): Zustand, dnd-kit, Motion, react-three-fiber.

Usa las versiones estables actuales y fíjalas con versión exacta en cada `package.json`.

## 5. Estructura del repo

```
sleevebook/
├── apps/
│   └── web/                 Next.js: visor y (luego) editor
├── packages/
│   ├── binder-core/         Dominio puro (sin React ni red)
│   ├── catalog/             Tipos de carta, reglas de variantes, parsers de listas
│   └── db/                  Esquema Drizzle, migraciones, cliente
├── scripts/
│   └── ingest/              Ingesta de catálogo + pipeline de imágenes a R2 (corre local y en GitHub Actions)
├── docs/
│   ├── PRODUCT.md           Documento de producto (fuente de verdad)
│   └── decisions/           ADRs cortos si una decisión necesita más contexto
├── seed/
│   └── master-sets.json     267 cartas de los dos master sets + códigos de bolsillo (Fase 1)
├── .github/workflows/       CI (lint, typecheck, test) e ingesta programada
├── docker-compose.yml       Postgres local
├── Dockerfile               Imagen de apps/web
├── railway.json             Config de despliegue
└── .env.example
```

## 6. Objetivo de esta sesión: Fase 0 — Fundaciones

Trabaja en este orden. Cada bloque tiene criterios de aceptación; no pases al siguiente sin cumplirlos.

### 6.1 Monorepo y calidad

- pnpm workspaces + Turborepo con tareas `build`, `dev`, `lint`, `typecheck`, `test`.
- Biome configurado; `tsconfig` base estricto compartido.
- CI en GitHub Actions: instala, lint, typecheck, test en cada push y PR.

**Aceptación:** `pnpm lint && pnpm typecheck && pnpm test` pasa en limpio localmente y en CI.

### 6.2 `packages/binder-core` (lo más importante de la fase)

Dominio puro, 100 % testeado. Tipos y funciones mínimas:

- `Format { rows, cols }`; `pocketsPerSide`, `pocketsPerSheet`, `capacity(format, sheets)`.
- `PocketCode`: `parse("S3·B·5")`, `format({ sheet, side, index })`, alias ASCII `s3-b-5`, conversión a índice global 0-based en orden de lectura (hoja → frente → reverso → bolsillo).
- `Spread` (lo que se ve con el binder abierto): el spread 0 muestra solo el frente de la hoja 1; el spread *n* muestra el reverso de la hoja *n* y el frente de la hoja *n + 1*; el último muestra solo el reverso de la última hoja. Debe funcionar igual para apertura lateral y vertical (solo cambia la orientación).
- `Panel { id, anchor: PocketCode, span: { rows, cols } }`: `coveredPockets(panel, format)`, validación de que no se sale de la cara y de que no se solapa con otro panel.
- `slicePanel(panel, format, seamMm)`: devuelve, por bolsillo cubierto, el rectángulo de recorte normalizado (0–1) sobre la imagen del panel. Con `seamMm = 0` los recortes son contiguos y sin huecos.
- `reflow(layout, op)`: insertar o quitar en una posición desplazando lo que sigue, respetando bolsillos bloqueados (`locked`) y bolsillos cubiertos por paneles (no se mueven ni se pisan).
- `sortPockets(items, keys)`: orden compuesto estable (ej. `era → set → number → variant`), asc/desc, con comparador de número de carta que entiende `"76"`, `"GG26"`, `"SV21"`, `"55a"`, `"SWSH291"`.
- `sectionize(items, by, { startOnNewSide })`: agrupa por era o set y, si se pide, empieza cada sección en cara nueva.
- `layoutSchema` (Zod) del documento de layout, como está en "Modelo de datos" de `docs/PRODUCT.md`.

**Casos de test obligatorios (como mínimo):**

- 3×3 con 20 hojas = 360 bolsillos; 4×4 con 20 hojas = 640.
- `S1·F·1` ↔ índice 0; `S1·B·1` ↔ 9; `S20·B·9` ↔ 359 (3×3).
- Spreads de un binder 3×3 de 20 hojas = 21 spreads; el primero y el último muestran una sola cara.
- Un panel de página completa en `S1·F·1` cubre los 9 bolsillos del frente de la hoja 1; un panel fila en `S2·F·7` con span 1×3 cubre 7, 8, 9; un span 2×2 en `S1·F·3` es inválido (se sale).
- `slicePanel` de una fila 1×3: tres recortes `[0, 1/3]`, `[1/3, 2/3]`, `[2/3, 1]` en x, sin huecos.
- `reflow` insertando en `S1·F·1` con un panel en `S1·F·4..6`: el contenido salta el panel y nada se pisa.
- Orden por número: `["10", "2", "GG26", "55a", "55"]` → `["2", "10", "55", "55a", "GG26"]` (los numéricos primero; definir y documentar la regla para los alfanuméricos).

**Aceptación:** cobertura ≥ 95 % en `binder-core`; sin dependencias de runtime excepto `zod`.

### 6.3 `packages/db`: esquema y migraciones

- Tablas: `game`, `set`, `card`, `card_variant`, `external_id`, `price_point`, `user` (y tablas de Better Auth), `card_instance`, `binder`, `binder_version` (layout JSONB), `art_asset`, `goal`, `share_link`. Campos según "Modelo de datos" de `docs/PRODUCT.md`.
- Índices: `card(set_id, number)`, `card_variant(card_id, variant)`, `price_point(variant_id, source, captured_at desc)`, `external_id(provider, external_id)` único.
- `docker-compose.yml` con Postgres 16 local; `pnpm db:migrate`, `pnpm db:studio`.

**Aceptación:** migraciones aplican en limpio sobre una base vacía y son reversibles en desarrollo.

### 6.4 `scripts/ingest`: catálogo inicial

- Fuente: repo público `PokemonTCG/pokemon-tcg-data` (JSON de sets y cartas EN). Descarga por tarball de GitHub; no uses la API en vivo.
- Upsert idempotente de `set`, `card`, `card_variant` y `external_id` (id de pokemontcg.io y código PTCGO del set).
- Reglas de variantes (las mismas del tracker actual; dejarlas configurables en `packages/catalog`):
  - Rareza base `Rare Holo` → variante `holo`; `Common`, `Uncommon`, `Rare` → `normal`; rarezas especiales (ex, V, VSTAR, GX, Illustration Rare, SIR, Hyper Rare, Shiny, etc.) → `holo`.
  - Agregar `reverse` a Common/Uncommon/Rare/Rare Holo en sets normales; **no** en promos ni en sets sin reverse (POP Series, Pokémon Rumble, McDonald's, Hidden Fates Shiny Vault, Crown Zenith Galarian Gallery).
  - En Prismatic Evolutions, White Flare y Black Bolt, en lugar de `reverse`: `pokeball` y `masterball`.
  - Marcar como "por confirmar" las variantes inferidas en sets muy recientes.
- Workflow de GitHub Actions semanal que corre la ingesta contra la base de producción (credenciales por secrets).

**Aceptación:** la ingesta carga todo el catálogo EN; correrla dos veces no duplica nada; buscar "Lucario" devuelve las impresiones esperadas.

### 6.5 `scripts/ingest`: pipeline de imágenes

- Al ingestar cada `card_variant`, descargar su imagen desde la URL del catálogo (pokemontcg.io) y subirla a R2 (`@aws-sdk/client-s3`) con una key determinística (ej. `cards/{set_id}/{number}/{variant}.jpg`).
- Generar derivados con `sharp` y subir cada uno a R2: miniatura (≈245×342), mediana (≈490×684) y alta (original, ≈734×1024). Sin ampliado por IA todavía (eso es un paso posterior, bajo demanda).
- Guardar en `card_variant` (o en una tabla de imágenes si así queda modelado) las URLs públicas servidas por `PUBLIC_ASSETS_URL` (CDN de Cloudflare delante de R2), no las de pokemontcg.io.
- Idempotente: si la key ya existe en R2 (o el registro ya tiene URL), no la vuelve a descargar ni a subir.

**Aceptación:** después de correr la ingesta, los tres derivados de cada variant del catálogo EN existen en R2; `card_variant` apunta a URLs de `PUBLIC_ASSETS_URL`; repetir la ingesta no vuelve a subir lo que ya está.

### 6.6 `apps/web`: esqueleto desplegable

- `GET /api/health` → `{ status: "ok", db: "ok" | "error", version }`.
- Página `/demo` que renderiza **una cara 3×3** a partir de un layout de ejemplo validado con `layoutSchema` (cartas como imagen plana + un placeholder + un vacío). Sin editor todavía.
- Variables de entorno validadas al arrancar (Zod): `DATABASE_URL`, `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `PUBLIC_ASSETS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Documentadas en `.env.example`.

**Aceptación:** `pnpm dev` levanta la web contra el Postgres local; `/demo` muestra la cara; Playwright tiene un test que la abre y verifica 9 bolsillos.

### 6.7 Docker y Railway

- `Dockerfile` multi-stage (deps → build → runner) para `apps/web` con salida standalone, usuario no root, imagen final pequeña.
- Config de despliegue en `railway.json` (builder Dockerfile, `healthcheckPath: "/api/health"`, política de reinicio). Verifica el esquema actual de Railway antes de escribirlo.
- Las migraciones corren como paso previo al arranque (comando de pre-deploy o script de inicio idempotente).
- Escríbeme un `docs/DEPLOY.md` con los pasos manuales que me tocan a mí:
  1. Crear el proyecto en Railway, servicio web desde el repo y servicio Postgres.
  2. Variables de entorno.
  3. **Control de gasto:** configurar el límite de uso y las alertas de facturación en Railway (verifica dónde está hoy esa opción en el panel), dejar la web con 512 MB de RAM como máximo, y evaluar si conviene activar la suspensión del servicio sin tráfico.
  4. Dominio `sleevebook.com` en Cloudflare apuntando a Railway.
  5. Bucket R2 y token con permisos solo sobre ese bucket.

**Aceptación:** la imagen construye localmente (`docker build`) y arranca con un `.env` de prueba; `/api/health` responde dentro del contenedor.

## 7. Fuera de alcance en esta sesión

Editor con drag & drop, animaciones, holo, importación de mazos, precios, auth en la UI y modo vendedor. Llegan en las fases 1 a 3 del Roadmap.

## 8. Convenciones

- Commits con Conventional Commits (`feat(binder-core): …`).
- Una rama por bloque (`phase0/binder-core`, `phase0/db`, …) y PR hacia `main`.
- Sin `any` explícito; errores de dominio como tipos, no como strings sueltos.
- Todo lo que dependa de un proveedor (S3, correo, precios) va detrás de una interfaz en un archivo propio.
- Nada de secretos en el repo; `.env.example` siempre al día.

## 9. Cierre de la sesión

Al terminar, dame:

1. Resumen de lo hecho por bloque (6.1 a 6.7) con el estado de sus criterios de aceptación.
2. Las casillas de "Fase 0" en `docs/PRODUCT.md` que puedo marcar.
3. Decisiones nuevas para el registro (fecha, decisión, motivo).
4. Lo pendiente y la propuesta para la siguiente sesión (Fase 1: editor y migración del tracker con `seed/master-sets.json`).

Empieza confirmando que leíste `docs/PRODUCT.md` y proponiendo el plan para 6.1 y 6.2.