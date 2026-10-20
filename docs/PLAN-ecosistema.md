# PLAN — Ecosistema VPS (aprobado)

> Estado: aprobado. Orden de ejecución 0→11. Decisiones tomadas al final.

## Arquitectura

```
<workspace>\                    # carpeta local de trabajo (no es repo)
├── secrets.json                 # secretos unicos (VPS, JWT, LLM, stagehand)
├── transversales\
│   ├── der\                     # motor: identidad, permisos, patches
│   ├── iswc-base\               # kit + renderShell + testing
│   ├── dev-vps\                 # perfil DSH + herramientas CI/CD
│   └── android-wc\              # NUEVO: base APK + updates + nativo
├── erp-sqlite\                  # sistema DB
│   ├── app\erp-sqlite-api\      :8091  (db-admin + catalogos + SPA)
│   ├── app\erp-sqlite-front\    CDN    (catalogos plural/singular, consola SQL)
│   ├── app\erp-sqlite-android\  APK
│   └── db\                      # NUNCA a git
├── usrs\                        # sistema usuarios/login/permisos
│   ├── app\usrs-api\            :8092
│   ├── app\usrs-front\          CDN
│   └── app\usrs-android\        APK
└── admn-vps\                    # sistema admin del VPS
    ├── app\admn-vps-api\        :8093 (+ gateway DSH web :8094)
    ├── app\admn-vps-front\      CDN
    └── app\admn-vps-android\    APK
```

**Reglas de raiz:** dentro de `app/` van los repos; fuera, herramientas y config transversal.
**Regla de sync:** local → git push; remoto → git pull. Nunca SFTP de codigo.
Solo `secrets.json` y `env.json` viajan por SFTP.

## Decisiones (tomadas)

| # | Decision |
|---|---|
| 1 | El servicio de permisos de terceros se **reemplaza por usrs**. Nada de ISS/ContaPyme en el camino. |
| 2 | **JWT ES256 + JWKS**. usrs firma; las demas verifican con llave publica. Sin secreto compartido. |
| 3 | Carpeta = `app/<sistema>-api` / `-front` / `-android`. |
| 4 | Si: **patches = agentes**; consola SQL = personas con `erp.sql.write` + auditoria. |
| 5 | nginx: **un puerto TLS por sistema**, cada SPA en su raiz `/` y su API en `/api`. |

## Fases

| # | Fase | Entregable | Aceptacion |
|---|---|---|---|
| 0 | Estandar | `transversales/dev-vps/ESTANDAR.md` enlazado desde cada repo | Existe y todos lo enlazan |
| 1 | Reorganizar erp-sqlite | `git mv` a `app/erp-sqlite-*`; la db pasa a la raíz del monorepo | Clon limpio pasa gates |
| 2 | `env.json` | Esquema Zod comun; `db.root`, `peers`, `front.sha`, `secrets.$secret:` | Arranca solo con env.json |
| 3 | dev-vps | Perfil DSH + `ssh-run`, `sftp-secrets`, `deploy-pull`, `doctor`, `install.sh` | VPS limpio reproduce todo |
| 4 | Kit ISWC | `renderShell(meta)` + hook `?s=` + perfil `server/` + `<iswc-login-gate>` | Guardianes verdes |
| 5 | DER | ES256+JWKS, pepper separado, `trustProxy` ultimo salto, `denyByDefault`, motor `patches/*.sql.ts` + `_patches` + `deno task patch` | Tests verdes |
| 6 | **usrs** | `:8092`: identity+permissions+seeds+JWKS+introspeccion+CRUD; front login/sesion/admin | e2e login, 429, revocacion |
| 7 | **erp-sqlite-api** | `:8091`: CRUD DB/tablas/columnas/indices/vistas/triggers/filas, import/export, SQL nativo auditado, catalogos en `db/_sistema/catalogos.sqlite` | e2e CRUD + 401/403 + auditoria |
| 8 | **erp-sqlite-front** | `<erp-catalogo-plural>` (ag-grid CRUD), `<erp-catalogo-singular>` (form), vistas admin | usrs-front consume por CDN |
| 9 | Testing | `pruebas.ts`+cooldown (API), Stagehand (front), cruzado usrs↔erp | `test:all` verde local y VPS |
| 10 | Corte VPS | dev-vps + patches + servicios 8091/8092 + nginx | Login real por `:9443` |
| 11 | **admn-vps** | `:8093`: chat DSH conversacional, servicios/estado del sistema, acciones sobre repos (pull/commit/push), gateway DSH web `:8094` protegido por login y perfil `admn-vps` | Solo rol `admn-vps` accede; responsive; APK |
| 12 | **android-wc** | `transversales/android-wc`: base APK (modelo `android-holamundo`), updater automatico, vendor, nativo | APK consume componentes por CDN y se actualiza sola |

## admn-vps (fase 11) — detalle

| Pieza | Funcion |
|---|---|
| Chat DSH | conversacional; recibe orden, ejecuta en el VPS via perfil `dev-vps`, devuelve explicacion |
| Panel | lista de servicios, puertos, contenedores, estado DB, logs |
| Acciones | `git pull`, gate, restart, rollback, abrir patch |
| DSH web | `:8094` detras de nginx con login; solo perfil `admn-vps` |
| Seguridad | token usrs + accion `admn.*`; `denyByDefault`; auditoria de cada accion |

**Regla:** ninguna accion destructiva sin confirmacion explicita en el chat.

## android-wc (fase 12) — detalle

- Base: `android-holamundo` (WebView + assets + updater).
- Consume el front web por CDN (mismos componentes, mismo login).
- `vendor` para actualizar herramientas en caliente.
- Puente nativo expuesto a los componentes (`iswc`/`erp` namespaces).
- Release con versionCode autoincremental y canal de actualizacion.

## Reglas transversales (no negociables)

1. Todo en **Deno**; ningun front con puerto propio: la API sirve su SPA en `/`.
2. Todo front es **iswc-base**; componentes por CDN con SHA40.
3. Cada API publica su **`front.ts`** (Zod + fetch) por CDN.
4. Parametros complejos en **JSON**, tipados con Zod.
5. Cambios de esquema **solo** por `patches/NNNN-*.sql.ts` ejecutados por el agente.
6. Las APIs **no** ejecutan patches solas: avisan si falta alguno.
7. `secrets.json` solo por SFTP; nunca en repos.
8. `db/` nunca a git; `env.json` por host, `env.example.json` versionado.
9. Testing homogeneo ISWC (cooldown, Stagehand) en todas las apps.
10. Responsive obligatorio: todo componente debe servir web y APK.
