# Despliegue en Railway

Pasos manuales para poner `apps/web` en producción. Verificado contra la documentación de Railway al 13-10-2026.

## Aviso importante: `railway.json` ya no sirve para esto

El kickoff original pedía un `railway.json` (builder Dockerfile, `healthcheckPath`, restart policy). Verificándolo ahora: **Railway deprecó "Config as Code" (`railway.json`/`railway.toml`) y los servicios nuevos ya no pueden usarlo en absoluto** — solo sigue funcionando hasta el 2026-12-01 para servicios que ya lo tenían. El reemplazo es "Infrastructure as Code" (`.railway/railway.ts`), pero no pude confirmar en la documentación la sintaxis exacta para build por Dockerfile, así que no quise inventarla.

En su lugar, este repo no trae ningún archivo de config de Railway. Hace falta:
- **Nada para el build**: Railway detecta el `Dockerfile` en la raíz del repo automáticamente y lo usa sin que indiques nada.
- **Healthcheck, restart policy y el comando de pre-deploy**: se configuran a mano en el dashboard (Settings → Deploy del servicio), como se detalla en el paso 2 más abajo. Es una UI estable, no parte de lo deprecado.

Si en una sesión futura queremos pasar a `.railway/railway.ts`, hay que revisar la [referencia oficial](https://docs.railway.com/infrastructure-as-code/reference) primero.

## 1. Crear el proyecto

1. En [railway.com](https://railway.com), **New Project** → **Deploy from GitHub repo** → elegí `sleevebook`.
2. Railway detecta el `Dockerfile` de la raíz solo. Si por algún motivo no lo detecta, Settings → Build → Builder → `Dockerfile`.
3. Agregá un servicio **Postgres** al mismo proyecto (botón **+ New** → **Database** → **PostgreSQL**). Railway le inyecta `DATABASE_URL` automáticamente a los servicios del mismo proyecto que la referencien (`${{Postgres.DATABASE_URL}}` en variables, o copiála a mano).

## 2. Configurar el servicio web

En el servicio web → **Settings → Deploy**:

| Campo | Valor |
|---|---|
| Healthcheck Path | `/api/health` |
| Restart Policy | `ON_FAILURE`, reintentos: 3 (ajustá a gusto) |
| Pre-Deploy Command | `pnpm --dir db-migrate run migrate:apply` |

El comando de pre-deploy corre **dentro de la misma imagen** ya construida, antes de que el tráfico pase al nuevo deploy. El `Dockerfile` deja un paquete autocontenido de `@sleevebook/db` en `/app/db-migrate` (vía `pnpm deploy --prod --legacy`) con todo lo necesario para aplicar las migraciones sin `drizzle-kit` en runtime — ver `packages/db/src/migrate-cli.ts`. Lo probé localmente (`docker run` con ese mismo comando contra una base vacía): aplica las 16 tablas y es idempotente.

## 3. Variables de entorno

En Settings → Variables, agregá las 8 que valida `apps/web/src/env.ts` al arrancar:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
S3_ENDPOINT=<endpoint del bucket R2, paso 5>
S3_BUCKET=<nombre del bucket>
S3_ACCESS_KEY_ID=<del token R2>
S3_SECRET_ACCESS_KEY=<del token R2>
PUBLIC_ASSETS_URL=<dominio público del bucket, o el dev.r2.dev mientras no haya CDN propio>
BETTER_AUTH_SECRET=<generá uno con: openssl rand -hex 32>
BETTER_AUTH_URL=https://sleevebook.com
```

Si el servicio arranca sin alguna de estas, falla rápido con un error de Zod (`src/env.ts`, cargado desde `instrumentation.ts`) — es intencional, así nunca corre medio-configurado.

### Login con Google (Fase 4)

Desde la Fase 4 las páginas del dueño (`/binders/...`) exigen sesión; los links públicos (`/s/...`, `/e/...`) siguen abiertos. Sin estas variables nadie puede entrar a editar:

```
GOOGLE_CLIENT_ID=<del OAuth Client de Google Cloud>
GOOGLE_CLIENT_SECRET=<del OAuth Client de Google Cloud>
OWNER_EMAIL=<tu correo de Google: la primera cuenta con ese correo hereda los binders creados antes del login>
```

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client ID* → tipo *Web application* (si lo pide, configurá antes la pantalla de consentimiento en modo *External* / *Testing* y agregá los correos de la beta como *test users*).
2. *Authorized JavaScript origins*: el valor de `BETTER_AUTH_URL` (hoy `https://sleevebook.com`).
3. *Authorized redirect URIs*: `<BETTER_AUTH_URL>/api/auth/callback/google`.
4. Copiá client id y secret a las variables de Railway. `BETTER_AUTH_URL` tiene que ser exactamente la URL pública del servicio (sin `/` final) o Google rechaza el callback.

`AUTH_DEV_LOGIN=1` (login con correo y contraseña para dev local y e2e) **no** va en Railway: el código lo ignora en builds de producción igual.

## 4. Control de gasto

Verificado en el dashboard actual (Workspace → Usage):

1. Ve a `railway.com/workspace/usage` → **Set Usage Limits**. Hay dos límites independientes, de Compute y de Agent:
   - **Soft limit** (alerta por mail, no corta nada).
   - **Hard limit** (apaga todos los workloads del workspace al llegar — mínimo $10). Llegan avisos por mail al 75%, 90% y 100%.
2. Alternativa por CLI: `railway usage limit set --target workspace --soft 15 --hard 25` (ajustá los números a tu presupuesto).
3. **Límite de RAM del servicio web**: Settings → Deploy → **Replica Limits**, poné 512 MB como tope. Nota: la propia guía de Railway recomienda 1.5–2× el pico observado (no 512 MB fijo) para evitar OOM-kills; si el servicio empieza a reiniciarse por memoria, subilo y preferí bajar el hard limit de gasto en vez de ahorrar por este lado.
4. **Suspender el servicio sin tráfico** (Settings → Deploy → **Serverless** → activar): apaga el servicio tras 10 min sin tráfico *saliente* y lo despierta en el próximo request (con un cold-start corto). Ojo: nuestra conexión a Postgres (`postgres-js`, sin `idle_timeout` configurado) mantiene la conexión abierta, lo que puede contar como tráfico saliente y evitar que llegue a dormir. Si lo activás y no ves que suspenda, es por esto — se resuelve configurando `idle_timeout` en `createDb()` (`packages/db/src/client.ts`), pendiente para cuando se active esta opción.

## 5. Dominio en Cloudflare

1. En Railway, Settings → Networking → **Custom Domain** → agregá `sleevebook.com` (o el subdominio que uses). Railway te da un CNAME/A objetivo.
2. En Cloudflare DNS, apuntá el dominio a ese target. Con proxy de Cloudflare activado (nube naranja) para tener CDN/WAF gratis delante.

## 6. Bucket R2 y token

1. Cloudflare dashboard → R2 → **Create bucket** (ej. `sleevebook-prod`).
2. R2 → **Manage API tokens** → crear un token con permisos **solo sobre ese bucket** (no "todos los buckets de la cuenta"). Copiá `Access Key ID` y `Secret Access Key`.
3. El **endpoint S3** de R2 tiene la forma `https://<account-id>.r2.cloudflarestorage.com`.
4. Para `PUBLIC_ASSETS_URL`, usá un **subdominio dedicado, no el dominio raíz**: `assets.sleevebook.com`. El raíz (`sleevebook.com`) queda libre para la app del paso 5. R2 → bucket → **Settings → Custom Domains → Connect Domain** → `assets.sleevebook.com` (como el dominio ya está en tu Cloudflare, el DNS y el certificado se crean solos). Queda `PUBLIC_ASSETS_URL=https://assets.sleevebook.com`.

## 7. Seed inicial de datos (una sola vez, post-deploy)

El pre-deploy solo aplica migraciones de **esquema** (tablas vacías). Antes de poder crear el primer binder hacen falta dos pasos manuales contra la `DATABASE_URL` de producción (vía `railway run` o el proxy público temporal, como se usó la primera vez):

1. **Fila `dev-user`**: mientras no haya login real (Better Auth, pendiente de Fase 1), todo binder se crea con `user_id = 'dev-user'`, una fila fija en la tabla `user`. Si falta, crear cualquier binder falla con una violación de foreign key y Next.js muestra el error genérico "A server error occurred" sin detalle. Insertarla una vez:
   ```sql
   INSERT INTO "user" (id, name, email, handle) VALUES ('dev-user', 'Johans', 'dev@sleevebook.local', 'johans');
   ```
   (mismos valores que `ensureDevUser()` en `packages/db/src/dev-user.ts`).
2. **Catálogo**: correr `pnpm --filter @sleevebook/ingest start` apuntando a producción para cargar sets/cartas/variantes. El código actual (desde el fix de octubre 2026) hace batch por set dentro de una transacción; aun así, contra una conexión con latencia real (el proxy público de Railway, o la futura ejecución del cron diario) puede ser lento o inestable — preferir correrlo desde dentro de la red privada de Railway (mismo proyecto) en vez del proxy público si es posible.

Si en algún momento se recrea la base desde cero, repetir ambos pasos antes de usar la app.
