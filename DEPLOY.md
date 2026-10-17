# DEPLOY — cómo está montado el VPS (verificado 2026-10-17)

Estado real y reproducible. Todo en Deno 2.9.7. nginx TLS en `:9443` (certificado self-signed en
`/etc/nginx/certs/`), dos APIs internas en `127.0.0.1` y el front estático.

## Mapa de rutas (nginx :9443)

| Ruta pública | Destino | Qué es |
|---|---|---|
| `/` | `root /opt/erp-sqlite-new/app/erp-sqlite-front` | front estático (iswc) |
| `/api/` | `127.0.0.1:8091` (erp-sqlite-api) | CRUD de bases + catálogos |
| `/usrs/api/` | `127.0.0.1:8092/api/` (usrs-api) | login ES256, JWKS, usuarios/roles |
| `/usrs/` | estático `/opt/usrs/app/usrs-front` | SPA de usuarios (web components) |

## Servicios systemd

| Servicio | WorkingDirectory | Puerto | DENO_DIR |
|---|---|---|---|
| `erp-sqlite-api` | `/opt/erp-sqlite-new/app/erp-sqlite-api` | 8091 | `/opt/erp-sqlite-new/.deno` |
| `usrs-api` | `/opt/usrs/app/usrs-api` | 8092 | `/opt/usrs/.deno` |

```ini
[Service]
WorkingDirectory=/opt/usrs/app/usrs-api
ExecStart=/usr/local/bin/deno run --allow-net --allow-env --allow-read --allow-write=/opt/usrs/db src/main.ts
Restart=on-failure
RestartSec=3
Environment=DENO_DIR=/opt/usrs/.deno
```

## Config (por host, fuera de git)

- `/opt/usrs/secrets.json` — `{ usrs: { jwt: { privateJwk, publicJwk }, jwtSecret, pepper, adminPassword } }` (chmod 600).
- `/opt/usrs/app/usrs-api/env.json` — `db.root=/opt/usrs/db`, `db.sistema=_sistema/usrs.sqlite`, `identity.jwt.alg=ES256`,
  `identity.trustProxy=1`, `permissions.grupo=usrs`, secretos por `$secret:usrs.*`.
- `/opt/erp-sqlite-new/secrets.json` — `{ erp: { jwtSecret, adminPassword } }` (chmod 600).
- `/opt/erp-sqlite-new/app/erp-sqlite-api/env.json` — `db.root=/opt/erp-sqlite-new/db`.

## Despliegue desde cero

```bash
# 1) Deno
curl -fsSL -o /tmp/deno.zip https://github.com/denoland/deno/releases/download/v2.9.7/deno-x86_64-unknown-linux-gnu.zip
unzip -oq /tmp/deno.zip -d /usr/local/bin && chmod 755 /usr/local/bin/deno

# 2) repos
git clone --recurse-submodules https://github.com/Jeff-Aporta/usrs /opt/usrs
git clone --recurse-submodules https://github.com/Jeff-Aporta/erp-sqlite /opt/erp-sqlite-new
mkdir -p /opt/usrs/db/_sistema /opt/usrs/.deno /opt/erp-sqlite-new/db/_sistema /opt/erp-sqlite-new/.deno

# 3) cache (primera vez, con red)
cd /opt/usrs/app/usrs-api && DENO_DIR=/opt/usrs/.deno deno cache src/main.ts
cd /opt/erp-sqlite-new/app/erp-sqlite-api && DENO_DIR=/opt/erp-sqlite-new/.deno deno cache src/main.ts

# 4) config: copiar secrets.json + env.json (SFTP; nunca por git)
#    ver las rutas de arriba.

# 5) servicios systemd (ver bloque [Service]) + nginx (ver snippet abajo)
systemctl daemon-reload && systemctl enable --now usrs-api erp-sqlite-api
nginx -t && systemctl reload nginx
```

## Snippet nginx (`/etc/nginx/sites-available/erp-catalog`, listen 9443 ssl)

```nginx
location /usrs/api/ { proxy_pass http://127.0.0.1:8092/api/; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Real-IP $remote_addr; }
location /usrs/     { alias /opt/usrs/app/usrs-front/; try_files $uri $uri/ /usrs/index.html; }
location /api/      { proxy_pass http://127.0.0.1:8091;      proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Real-IP $remote_addr; }
location /          { root /opt/erp-sqlite-new/app/erp-sqlite-front; try_files $uri $uri/ /index.html; }
```

## Verificación

```bash
curl -sk -X POST https://127.0.0.1:9443/usrs/api/login -H 'content-type: application/json' -d '{"usuario":"admin","password":"UsrsAdmin2026!"}'   # ES256
curl -sk https://127.0.0.1:9443/usrs/api/.well-known/jwks.json
curl -sk -X POST https://127.0.0.1:9443/api/login -H 'content-type: application/json' -d '{"usuario":"admin","password":"AdminTemp2026!"}'
```

## Fronts estáticos

| App | Origen |
|---|---|
| erp-sqlite-front | `/opt/erp-sqlite-new/app/erp-sqlite-front` (index.html + dist/cdn) |
| usrs-front | `/opt/usrs/app/usrs-front` (index.html + src/app.css + src/usrs-app.js) |

Ambos usan **Poppins** y `--iswc-card-spacing` amplio. Todo con web components del kit.

## Credenciales iniciales

- usrs: `jagudeloe` / `udtccsso` (cambiar tras el primer login).
- erp-sqlite: `jagudeloe` / `udtccsso` (cambiar tras el primer login).

## Pendiente de endurecimiento

- Los servicios corren como `root`; crear usuarios `usrs`/`erp` y `ProtectSystem=strict`.
- Rotar contraseñas iniciales; `ufw`; login por llave y desactivar root por contraseña.
