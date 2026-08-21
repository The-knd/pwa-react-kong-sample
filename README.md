# POS MVP — Microservicios + Kong Gateway + PWA React

MVP de punto de venta cuyo objetivo es **validar una arquitectura**, no ser un
producto completo: backend en microservicios NestJS detrás de Kong Gateway,
PostgreSQL separado por dominio y frontend PWA en React.

**Alcance Fase 1**: backend completo (auth, usuarios, clientes, ventas) +
frontend con login y creación de clientes. Dos roles sembrados en BD:
`admin` (crea usuarios, ve ventas) y `vendedor` (crea ventas y clientes).

---

## 1. Infraestructura

### 1.1 Vista general

```
[Navegador / PWA instalada]
        │  http://localhost:3000   (todo same-origin)
        ▼
┌─────────────────────────────────────────────┐
│ frontend (nginx :3000)                      │
│  /            → estáticos PWA + service     │
│  /api/*       → proxy → kong:8000           │
└─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ Kong Gateway (:8000, modo DB-less)          │
│  · routing por prefijo /api/v1/<dominio>    │
│  · CORS con credenciales                    │
│  · rate-limit 20/min solo en /auth          │
└─────────────────────────────────────────────┘
        │ red interna pos-net (172.30.0.0/24)
   ┌────┴─────────┬───────────────┬──────────────┐
   ▼              ▼               ▼              ▼
auth-service  users-service  clients-service  sales-service
(.11 :3000)   (.12 :3000)    (.13 :3000)      (.14 :3000)
   │              │               │              │
   └── users_db ──┘          clients_db     sales_db
   (credenciales+refresh)                        (+ products seed)
                      todo dentro de 1 contenedor postgres (.16-alpine)
```

### 1.2 Contenedores

| Contenedor | IP fija | Puerto host | Healthcheck | Volúmenes |
|---|---|---|---|---|
| `postgres` | 172.30.0.2 | — (5432 comentado) | `pg_isready` | `pgdata`, `./db/init` (ro) |
| `auth-service` | .11 | interno | `GET /health` | claves RSA (ro) |
| `users-service` | .12 | interno | `GET /health` | clave pública (ro) |
| `clients-service` | .13 | interno | `GET /health` | clave pública (ro) |
| `sales-service` | .14 | interno | `GET /health` | clave pública (ro) |
| `kong` | .20 | **8000** | `kong health` | `./gateway/kong.yml` (ro) |
| `frontend` | .21 | **3000** | `GET /` | — |

Solo Kong y el frontend publican puertos al host; los microservicios y la BD
viven únicamente en la red interna `pos-net`.

### 1.3 Ciclo de vida de una petición

Ejemplo: el vendedor crea un cliente desde la PWA.

1. El navegador hace `POST /api/v1/clients` a `localhost:3000` con
   `credentials: 'include'`; las cookies `at`/`rt` viajan solas.
2. nginx del frontend sirve los estáticos y reenvía `/api/*` a Kong sin
   tocar la ruta → **same-origin**: no hay CORS ni cookies de terceros.
3. Kong hace match con la ruta `/api/v1/clients` → upstream
   `http://clients-service:3000` (IP estática, sin depender del DNS).
4. En clients-service, el guard global `JwtAuthGuard` extrae la cookie `at`,
   verifica firma RS256 con la clave pública y expiración.
5. `RolesGuard` compara el claim `role` contra `@Roles('admin','vendedor')`
   del controlador. Sin rol válido → **403**.
6. `ValidationPipe` valida el DTO (class-validator). Payload inválido → **400**.
7. El servicio persiste en `clients_db` y responde. Errores inesperados se
   normalizan a `{statusCode, message}` sin filtrar stack traces.

### 1.4 Bases de datos

Un solo contenedor Postgres con tres bases lógicas (*database-per-service*
lógico, físico compartido por ser MVP):

| Base | Dominio | Dueño (servicio) | Tablas |
|---|---|---|---|
| `users_db` | identidad | auth-service + users-service | `users`, `refresh_tokens` |
| `clients_db` | clientes | clients-service | `clients` |
| `sales_db` | ventas | sales-service | `sales`, `sale_items`, `products` |

- El DDL vive en `db/init/*.sql` y corre **una sola vez** en el primer
  arranque (entrypoint oficial de Postgres). Los servicios usan
  `synchronize: false`: la BD es la fuente de verdad del esquema.
- Se crea un rol de aplicación `pos_app` con permisos solo sobre esas bases
  (nada de superusuario para los servicios).
- No hay FKs entre dominios (p. ej. `sales.client_id` referencia un UUID que
  vive en otra base): es el precio estándar de database-per-service.

---

## 2. Decisiones técnicas

### 2.1 Autenticación: JWT RS256 propio + cookies httpOnly

Opciones evaluadas:

| Opción | Veredicto |
|---|---|
| **JWT RS256 propio (elegida)** | Cero infra extra, control total, suficiente para MVP |
| Sesiones opacas + Redis | Revocación instantánea, pero suma un contenedor y un salto por request |
| Keycloak / Zitadel | OIDC completo, pero ~1 GB RAM y curva alta: sobredimensionado para validar arquitectura |
| Solo plugins Kong OSS | No gestiona usuarios/passwords/roles por sí solo |

Detalles de la implementación elegida:

- **RS256**: solo auth-service tiene la clave privada (`secrets/jwt-private.pem`);
  los demás servicios y una futura validación en el edge verifican con la
  pública. Compromiso mínimo de claves.
- **Cookies httpOnly** (y no Bearer en memoria): el JavaScript de la PWA
  *no puede leer* los tokens → inmune a robo por XSS. El front solo hace
  `fetch(..., {credentials:'include'})`.
  - Mitigación CSRF: `SameSite=Lax` + same-origin vía proxy nginx +
    endpoints que solo aceptan `Content-Type: application/json`.
- **Access token 15 min** (`cookie at`, path `/`) + **refresh 7 días**
  (`cookie rt`, path `/api/v1/auth`) **rotativo de un solo uso**: cada
  refresh revoca el anterior y guarda solo su hash sha256 en
  `users_db.refresh_tokens`. Reusar un rt viejo → 401.
- **Autorización**: los claims `sub`/`role` viajan en el JWT; cada servicio
  aplica `@Roles()` con guard global. Kong enruta, no decide permisos
  (defensa en profundidad; mover validación al edge es mejora de fase 2).
- **Por qué no validar en Kong hoy**: el plugin `jwt` de Kong OSS lee el
  header `Authorization`, no cookies. Validar en servicio funciona igual y
  añade una segunda capa.

### 2.2 Gateway: Kong DB-less

- Sin base de datos propia: toda la config vive en `gateway/kong.yml`
  declarativo. Recrear el contenedor es seguro; versionar la config es
  trivial (es un archivo del repo).
- Rate-limiting (20/min, policy local) **solo en auth**: freno básico a
  fuerza bruta donde más duele, sin castigar el resto de la API.
- CORS configurado con credenciales y origen explícito del PWA (para pruebas
  directas contra `:8000`; el flujo normal es same-origin).

### 2.3 IPs estáticas en docker-compose

Kong cachea las resoluciones DNS de sus upstreams. Al recrear contenedores,
Docker reasigna IPs y el gateway puede terminar hablándole al servicio
equivocado (bug real encontrado durante la validación). Con
`ipv4_address` fijas por servicio el problema desaparece y el compose es
determinista.

### 2.4 Backend: NestJS + npm workspaces

- Un solo `Dockerfile` parametrizado (`ARG SERVICE_NAME`) construye los 4
  servicios: menos duplicación, mismas capas cacheadas.
- Paquete `@app/common` con lo compartido: guards JWT/RBAC, estrategia
  passport que lee la cookie, filtro global de excepciones, healthcheck.
- `TypeORM` con `synchronize:false`: el esquema lo poseen los `init.sql`,
  nunca el ORM (evita drift entre entornos).
- `bcryptjs` (JS puro) en vez de `bcrypt` nativo: imágenes alpine sin
  toolchain de compilación; el costo de CPU es irrelevante en este MVP.

### 2.5 Frontend: Vite + React + vite-plugin-pwa

- Service worker con `navigateFallbackDenylist: [/^\/api\//]`: el SW jamás
  intercepta la API (datos frescos + cookies); solo precachea assets.
- Cliente HTTP único (`src/api/client.ts`) con refresh *single-flight*: si
  llegan varios 401 en paralelo, se refresca una sola vez y se reintenta.
- Guards de ruta (`RequireAuth`) solo guían la navegación/ocultan menús;
  la autoridad siempre es el backend.

### 2.6 Builds multi-stage

- Capa `deps` solo con manifiestos → caché de Docker efectiva.
- Runtime final: solo `node_modules` de producción (`npm prune --omit=dev`),
  dist compilado, usuario `node` sin privilegios, HEALTHCHECK integrado.
- Frontend: build Node → nginx alpine (~50 MB final).

---

## 3. Estructura del repositorio

```
pwa-react-kong-micro/
├── docker-compose.yml          # orquestación, IPs fijas, healthchecks
├── .env.example                # plantilla de variables (copiar a .env)
├── scripts/
│   └── generate-keys.mjs       # genera el par RSA en secrets/
├── secrets/                    # jwt-private.pem / jwt-public.pem (gitignored)
├── db/init/                    # DDL + seeds; corre solo en el 1er arranque
│   ├── 01-databases.sh         #   crea users_db, clients_db, sales_db + rol pos_app
│   ├── 02-users.sql            #   users, refresh_tokens + admin/vendedor seed
│   ├── 03-clients.sql
│   └── 04-sales.sql            #   sales, sale_items + 6 productos seed
├── gateway/
│   └── kong.yml                # rutas, CORS, rate-limit (DB-less)
├── backend/                    # npm workspaces
│   ├── Dockerfile              # multi-stage, ARG SERVICE_NAME
│   ├── common/                 # guards, estrategia cookie, filtros, tipos
│   ├── auth-service/           # login, refresh (rotación), logout, me
│   ├── users-service/          # CRUD usuarios [admin]
│   ├── clients-service/        # crear/listar clientes [admin, vendedor]
│   └── sales-service/          # crear venta [vendedor], listar [admin]
└── frontend/pwa-app/
    ├── Dockerfile              # build Vite → nginx alpine
    ├── nginx.conf              # estáticos + proxy /api → kong
    ├── scripts/generate-icons.mjs
    └── src/
        ├── api/client.ts       # fetch wrapper + refresh single-flight
        ├── auth/AuthContext.tsx
        ├── components/         # Layout (nav por rol), RequireAuth
        └── pages/              # Login, Home, NuevoCliente, Admin
```

---

## 4. Guía de uso

### 4.1 Requisitos

- Docker Engine + Docker Compose v2
- Node.js ≥ 20 (solo para generar claves/iconos fuera de Docker)

### 4.2 Primer arranque

```bash
cp .env.example .env                 # credenciales dev por defecto
node scripts/generate-keys.mjs       # crea secrets/jwt-{private,public}.pem
docker compose up --build -d
```

Espera ~40 s (los healthchecks encadenan postgres → servicios → kong) y
verifica:

```bash
docker compose ps        # los 7 contenedores "healthy"
curl http://localhost:8000/api/v1/auth/health   # {"status":"ok"}
```

Abre **http://localhost:3000**.

> Si regeneras las claves con tokens ya emitidos, esos tokens dejan de
> validar (firma nueva): cierra sesión y vuelve a entrar.

### 4.3 Credenciales seed (solo desarrollo)

| Usuario | Contraseña | Rol | Puede |
|---|---|---|---|
| `admin` | `admin123` | admin | crear/editar usuarios, ver ventas, crear clientes |
| `vendedor` | `vendedor123` | vendedor | crear ventas, crear/listar clientes |

### 4.4 Flujo en el navegador

1. `http://localhost:3000` → redirige a `/login` si no hay sesión.
2. Entra como `vendedor` → tarjeta "Nuevo cliente"; el menú NO muestra
   "Administración".
3. Crea un cliente → confirmación verde; duplicar documento → error 409
   mostrado en el formulario.
4. Cierra sesión, entra como `admin` → aparece "Administración" con consulta
   de ventas en vivo contra `GET /api/v1/sales`.
5. DevTools → Application → Cookies: `at` y `rt` con HttpOnly ✓ (el JS no
   puede leerlas).
6. La PWA es instalable (icono en la omnibox de Chrome; localhost cuenta como
   contexto seguro).

### 4.5 Smoke tests por API (curl)

```bash
# ── login y sesión ──────────────────────────────────────────────
curl -s -c /tmp/admin.jar -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  http://localhost:8000/api/v1/auth/login
curl -s -b /tmp/admin.jar http://localhost:8000/api/v1/auth/me

# ── RBAC ────────────────────────────────────────────────────────
# crear usuario [solo admin]
curl -s -b /tmp/admin.jar -H 'Content-Type: application/json' \
  -d '{"username":"caja2","password":"caja2123","role":"vendedor"}' \
  http://localhost:8000/api/v1/users
# sin sesión → 401
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/v1/users

# ── clientes [vendedor o admin] ─────────────────────────────────
curl -s -c /tmp/vend.jar -H 'Content-Type: application/json' \
  -d '{"username":"vendedor","password":"vendedor123"}' \
  http://localhost:8000/api/v1/auth/login
curl -s -b /tmp/vend.jar -H 'Content-Type: application/json' \
  -d '{"docType":"CC","docNumber":"1020304050","name":"María González"}' \
  http://localhost:8000/api/v1/clients

# ── refresh rota el token; reusar el viejo da 401 ───────────────
curl -s -b /tmp/vend.jar -c /tmp/vend.jar -X POST \
  http://localhost:8000/api/v1/auth/refresh

# ── venta (necesita IDs reales) ─────────────────────────────────
CLIENT=$(curl -s -b /tmp/vend.jar http://localhost:8000/api/v1/clients | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).items[0].id))")
PROD=$(docker exec pos-mvp-postgres-1 psql -U pos_app -d sales_db -tAc \
  "SELECT id FROM products WHERE sku='SKU-001'")
curl -s -b /tmp/vend.jar -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$CLIENT\",\"items\":[{\"productId\":\"$PROD\",\"quantity\":2}]}" \
  http://localhost:8000/api/v1/sales
# listar ventas [solo admin]
curl -s -b /tmp/admin.jar http://localhost:8000/api/v1/sales
```

Respuestas esperadas en los caminos negativos: `401` sin/expirado token,
`403` rol insuficiente, `409` documento duplicado o stock insuficiente,
`400` DTO inválido.

### 4.6 Inspeccionar bases de datos

```bash
docker exec pos-mvp-postgres-1 psql -U pos_app -d users_db   -c '\dt'
docker exec pos-mvp-postgres-1 psql -U pos_app -d clients_db -c '\dt'
docker exec pos-mvp-postgres-1 psql -U pos_app -d sales_db   -c 'SELECT sku,name,stock FROM products;'
```

(Para usar `psql` desde el host, descomenta `ports: ["5432:5432"]` en
postgres y reinicia.)

### 4.7 Comandos útiles

```bash
docker compose logs -f auth-service        # seguir logs de un servicio
docker compose restart kong                # recargar tras editar gateway/kong.yml*
docker compose up --build -d clients-service   # reconstruir UN servicio
docker compose down                        # parar (conserva datos)
docker compose down -v                     # parar Y borrar BDs (re-seed al volver a subir)
```

\* Kong DB-less solo lee `kong.yml` al arrancar: tras editarlo,
`docker compose restart kong`.

### 4.8 Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Kong `unhealthy` y log `"kong.yml: Is a directory"` | El archivo no existía al crear el contenedor y Docker montó un directorio | Borra el directorio `gateway/kong.yml`, restaura el archivo y `up -d --force-recreate kong` |
| 404 "Cannot POST /api/v1/..." tras recrear servicios | Kong sirviendo con config/IP viejas | `docker compose restart kong` (las IPs fijas evitan esto) |
| 401 generalizado después de regenerar claves | Tokens firmados con clave anterior | Logout + login; si persiste, borra cookies del navegador |
| Seeds no aparecen | El volumen `pgdata` ya existía (init corre una sola vez) | `docker compose down -v && docker compose up -d` |
| Puerto 3000 u 8000 ocupado | Otro proceso local | Cambia el mapeo en `docker-compose.yml` |

---

## 5. Seguridad implementada

- Contraseñas con bcrypt (coste 10); nunca se seleccionan en queries de login
  salvo explícitamente (`select: false` en la entidad).
- Refresh tokens: aleatorios de 384 bits, guardados **hasheados** (sha256),
  rotación de un solo uso, revocación en logout.
- Cookies `HttpOnly` + `SameSite=Lax`; `Secure` activable con
  `COOKIE_SECURE=true` cuando haya TLS.
- Clave privada RSA solo montada en auth-service (lectura); pública en el resto.
- Validación estricta de entrada (`whitelist` + `forbidNonWhitelisted`):
  propiedades no declaradas se rechazan.
- Errores normalizados sin stack traces; logs de errores solo en servidor.
- Rate limiting en el único endpoint público sensible.
- Contenedores sin privilegios, secretos como archivos read-only montados,
  `.env` y `secrets/` fuera del repositorio.

## 6. Límites conocidos y roadmap fase 2

Aceptados conscientemente para este MVP:

1. `sales-service` no verifica que `clientId` exista (está en otra base).
   Fase 2: llamada HTTP a clients-service o patrón SAGA.
2. Revocación inmediata de access tokens: depende del TTL de 15 min; sin
   blacklist (Redis sería el siguiente paso).
3. Validación JWT por servicio; moverla al edge de Kong (pre-function o
   Bearer) cuando haya TLS y se estandarice el transporte.
4. `products` sin microservicio propio: tabla seed dentro de `sales_db`.
5. Sin HTTPS local, sin observabilidad (tracing/métricas), sin CI.
6. UI mínima: módulos de usuarios y ventas completos en backend, pendientes
   en frontend.
