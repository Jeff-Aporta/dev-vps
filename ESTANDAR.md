# ESTANDAR — Ecosistema VPS

> Norma unica para todos los repos. Si algo contradice este archivo, gana este archivo.
> Version 1.0 — 2026-10-17

## 1. Estructura

```
<workspace>\                    # carpeta local de trabajo (no es repo)
  secrets.json                 # unico lugar de secretos (no se versiona)
  transversales\{der,iswc-base,dev-vps,android-wc}\
  <sistema>\
    app\<sistema>-api\          # Deno, sirve SPA en / y API en /api
    app\<sistema>-front\        # componentes iswc-base, se publica por CDN
    app\<sistema>-android\      # APK
    db\                         # NUNCA a git
    env.json                    # por host (env.example.json versionado)
```

Dentro de `app/` los repos; fuera, herramientas y config transversal.

## 2. Las 11 leyes

1. **Todo Deno.** Sin Node, sin Vite, sin bundler en runtime.
2. **Todo front es iswc-base** (vanilla web components + CDN pineado SHA40).
3. **Ningun front exponer puerto.** La API sirve su SPA en `/` y su API en `/api/*`.
4. **Cada API publica su `front.ts`** (tipos + fetch, Zod) por CDN.
5. **Parametros complejos en JSON**, validados con Zod. Nada de query strings largas.
6. **Cambios de esquema solo por patches**: `patches/NNNN-<nombre>.sql.ts` con `{ id, descripcion, up(ctx) }`.
7. **Las APIs no ejecutan patches solas**: al arrancar solo avisan si falta alguno.
8. **Local → git push; remoto → git pull.** Nunca SFTP de codigo.
9. **`secrets.json` y `env.json` son lo unico que viaja por SFTP.**
10. **Responsive obligatorio**: todo componente debe servir web y APK.
11. **Cada proyecto es atómico y hermético.** Entre proyectos solo se consume por vendor o
    import desde CDN fijado a SHA40 (jsDelivr); nunca rutas locales (absolutas a carpetas de
    trabajo, relativas que salgan del repo, `file:`/`link:`, symlinks). Cada repo lo prueba con
    su `tests/hermeticidad.test.*` (WHAT: nada versionado referencia rutas fuera del proyecto).

## 3. Sync (pull + push de todos los repos)

```
deno task sync          # pull + push de transversales y sistemas
deno task sync --dry    # ver diferencias
deno task sync:secrets  # SFTP de secrets.json y env.json
```

| Contenido | Direccion |
|---|---|
| codigo (todos los repos) | local → git push; VPS → git pull |
| `secrets.json`, `env.json` | SFTP local → remoto |
| `db/` | nunca sale del host; backup antes de tocar |

Reglas: `pull --rebase`; conflicto ⇒ abortar y reportar; despues de pull, regenerar pins si cambio un transversal.

## 4. Contratos entre sistemas

```
transversales/der        -> contratos de entidades y controllers
transversales/iswc-base  -> componentes + renderShell + testing
<sis>/app/<sis>-api     -> publica front.ts
<sis>/app/<sis>-front   -> vendoriza front.ts con // @vendor-pin <ISO>
```

- El pin de un contrato **no se descarga solo**: se copia y se marca con fecha.
- Pin con mas de 90 dias ⇒ el build falla.
- Prohibido `@main`, `@latest`, SHA corto.

## 5. Seguridad

- **JWT ES256 + JWKS**: `usrs` firma; las demas verifican con la llave publica.
- Revocacion por introspeccion a `usrs` con cache corta.
- `denyByDefault: true` en sistemas administrativos.
- Acciones por app: `<app>.<accion>` (ej. `erp.sql.write`, `admn.*`).
- Auditoria obligatoria: IP real (ultimo salto confiable), user-agent, dispositivo, accion.
- Pepper del hash **separado** del secreto JWT.

## 6. Testing

| Capa | Herramienta |
|---|---|
| API | `pruebas.ts` + cooldown (perfil server de iswc) |
| Front | salud + e2e Stagehand |
| Cruzado | usrs ↔ erp-sqlite ↔ admn-vps |

- Gate unico: `deno task test:all`. Verde = hecho.
- Mismo gate en local y en VPS.
- Llaves LLM/Stagehand en `secrets.json`, subidas por `sync:secrets`.

## 7. Registro de puertos

| Puerto | Sistema |
|---|---|
| 8091 | erp-sqlite-api |
| 8092 | usrs-api |
| 8093 | admn-vps-api |
| 8094 | DSH web (gateway con login) |
| 9443 | nginx TLS (unico publico) |

## 8. HTML del SPA

Cada API genera el HTML en `/` con `renderShell(meta)` de `iswc-base`:

```ts
renderShell({ titulo, descripcion, og, canonical, pin, loader, tags, dataAppReady })
```

- `?s=<id>` permite a la API ajustar titulo, descripcion y miniatura OG (SEO/redes).
- Sin archivos fisicos por app: todo dinamico.
- El loader de la app registra sus componentes sobre el loader de iswc.

## 9. Patches

```ts
// patches/0001-crear-usuarios.sql.ts
export const id = "0001-crear-usuarios";
export const descripcion = "tabla de usuarios";
export async function up(ctx) { /* usa controllers DER */ }
```

- Tabla `_patches (id, hash, aplicado, por)`.
- Runner: `deno task patch [--dry-run]`, con backup previo y transaccion.
- Seeds son patches.
- Solo el agente los ejecuta.
