# POS MVP — Microservicios + Kong Gateway + PWA React

MVP de punto de venta para **validar una arquitectura** (no es un producto):
backend en microservicios NestJS detrás de Kong Gateway, bases PostgreSQL
separadas por dominio y frontend PWA en React. Autenticación con JWT RS256
en cookies httpOnly — el frontend nunca conoce los tokens.

## Arquitectura

```
[Navegador / PWA]
      │  http://localhost:3000  (same-origin)
[frontend nginx]  ── /            → estáticos PWA + SW
      │ /api/*        ── proxy →
[Kong :8000]      ── routing, CORS, rate-limit (auth: 20/min)
      │
   ┌────────────┬────────────────┬─────────────┐
auth-service users-service clients-service sales-service
      │           │               │             │
      └── users_db ┘          clients_db    sales_db (+products)
              (1 contenedor postgres, 3 bases lógicas)
```

| Contenedor | IP fija | Puerto host | Notas |
|---|---|---|---|
| `postgres` | .2 | — | seeds automáticos en primer arranque |
| `auth-service` | .11 | interno | login/refresh/logout/me, firma RS256 |
| `users-service` | .12 | interno | CRUD usuarios `[admin]` |
| `clients-service` | .13 | interno | clientes `[admin, vendedor]` |
| `sales-service` | .14 | interno | ventas `[vendedor]`, listado `[admin]` |
| `kong` (DB-less) | .20 | **8000** | config declarativa `gateway/kong.yml` |
| `frontend` | .21 | **3000** | nginx + proxy same-origin a Kong |

Las IPs son estáticas a propósito: evita que Kong cachee IPs obsoletas al
recrear contenedores.

## Requisitos

- Docker + Docker Compose v2
- Node 20+ solo si quieres regenerar claves o iconos

## Arranque

```bash
cp .env.example .env          # credenciales dev por defecto
node scripts/generate-keys.mjs # genera secrets/jwt-{private,public}.pem (una vez)
docker compose up --build -d
```

Espera ~40 s (healthchecks) y abre **http://localhost:3000**.

Credenciales seed (solo desarrollo):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | admin: crea usuarios, ve ventas |
| `vendedor` | `vendedor123` | vendedor: crea ventas y clientes |

## Verificar funcionamiento

### 1. Flujo en el navegador (PWA)

1. Abre `http://localhost:3000` → redirige a `/login`.
2. Entra como `vendedor / vendedor123` → verás "Nuevo cliente".
3. Crea un cliente (tipo doc, número, nombre) → mensaje verde de éxito.
4. El menú NO muestra "Administración" (guarda por rol).
5. Cierra sesión y entra como `admin / admin123` → aparece "Administración";
   la tarjeta Ventas consulta `GET /api/v1/sales` en vivo.
6. DevTools → Application → Cookies: verás `at` y `rt` con HttpOnly ✓
   (inaccesibles desde JS).
7. Instalable como app (Chrome: icono instalar; localhost es contexto seguro).

### 2. Smoke tests API (curl)

```bash
# login (guarda cookies)
curl -s -c /tmp/admin.jar -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}' \
  http://localhost:8000/api/v1/auth/login

# sesión actual
curl -s -b /tmp/admin.jar http://localhost:8000/api/v1/auth/me

# crear usuario [admin]
curl -s -b /tmp/admin.jar -H 'Content-Type: application/json' \
  -d '{"username":"caja2","password":"caja2123","role":"vendedor"}' \
  http://localhost:8000/api/v1/users

# sin token → 401 | vendedor en /users → 403
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/v1/users

# crear cliente [vendedor]
curl -s -c /tmp/vend.jar -H 'Content-Type: application/json' \
  -d '{"username":"vendedor","password":"vendedor123"}' \
  http://localhost:8000/api/v1/auth/login
curl -s -b /tmp/vend.jar -H 'Content-Type: application/json' \
  -d '{"docType":"CC","docNumber":"1020304050","name":"María González"}' \
  http://localhost:8000/api/v1/clients

# refresh rota el rt: reusar el viejo da 401
curl -s -b /tmp/vend.jar -c /tmp/vend.jar -X POST http://localhost:8000/api/v1/auth/refresh
curl -s -X POST http://localhost:8000/api/v1/auth/refresh   # sin cookie → 401
```

Crear una venta requiere IDs reales:

```bash
CLIENT=$(curl -s -b /tmp/vend.jar http://localhost:8000/api/v1/clients | \
  node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).items[0].id))")
PROD=$(docker exec pos-mvp-postgres-1 psql -U pos_app -d sales_db -tAc \
  "SELECT id FROM products WHERE sku='SKU-001'")
curl -s -b /tmp/vend.jar -H 'Content-Type: application/json' \
  -d "{\"clientId\":\"$CLIENT\",\"items\":[{\"productId\":\"$PROD\",\"quantity\":2}]}" \
  http://localhost:8000/api/v1/sales
# admin puede listarla:
curl -s -b /tmp/admin.jar http://localhost:8000/api/v1/sales
```

### 3. Verificar BDs

```bash
docker exec pos-mvp-postgres-1 psql -U pos_app -d users_db   -c '\dt'
docker exec pos-mvp-postgres-1 psql -U pos_app -d clients_db -c '\dt'
docker exec pos-mvp-postgres-1 psql -U pos_app -d sales_db   -c 'SELECT sku,stock FROM products;'
```

## Decisiones de diseño

- **Auth (JWT RS256 + cookies httpOnly)**: solo auth-service firma (clave
  privada); los servicios verifican con la pública. Access token 15 min,
  refresh 7 días rotativo de un solo uso (hash sha256 en `users_db`).
  El front solo hace `fetch(..., {credentials:'include'})`; ante 401 intenta
  `/auth/refresh` una vez y reintenta.
- **Kong DB-less**: sin base propia; toda la config vive en `gateway/kong.yml`.
  Rate-limit 20/min solo en auth (freno a fuerza bruta).
- **Database-per-service lógico**: un contenedor Postgres, tres bases.
  `products` vive en `sales_db` como catálogo seed hasta fase 2.
- **Transacción en ventas**: valida stock, descuenta atómicamente
  (`UPDATE ... WHERE stock >= qty`) y persiste cabecera+líneas; el precio
  SIEMPRE viene del catálogo, nunca del cliente.
- **Builds multi-stage**: imágenes runtime solo con dependencias de
  producción, usuario `node` sin privilegios, healthchecks integrados.

## Límites conocidos (aceptados en MVP)

- `sales-service` no valida que `clientId` exista (viviría en otro servicio;
  fase 2: llamada HTTP o SAGA).
- Sin HTTPS local: `COOKIE_SECURE=false`. En producción ponerlo tras TLS.
- Revocación de access tokens depende del TTL corto (15 min); no hay blacklist.
- Seeds con contraseñas triviales: solo para validar la arquitectura.

## Estructura

```
├── docker-compose.yml       # orquestación + IPs estáticas
├── db/init/                 # DDL + seeds (idempotente, solo primer arranque)
├── gateway/kong.yml         # rutas, CORS, rate-limit
├── backend/                 # npm workspaces: common + 4 servicios NestJS
│   ├── common/              # guards JWT/RBAC, estrategia cookie, filtros
│   └── {auth,users,clients,sales}-service/
├── frontend/pwa-app/        # Vite + React + TS + vite-plugin-pwa
└── scripts/generate-keys.mjs
```
