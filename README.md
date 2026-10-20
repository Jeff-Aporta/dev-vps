# dsh-dev-vps

Perfil DSH y herramientas CI/CD del ecosistema VPS. Aquí vive la **norma única** (`ESTANDAR.md`) y
todo lo necesario para operar y reproducir el VPS desde cero (ssh, sftp de secretos, deploy, doctor).

## Contenido

| Ruta | Qué es |
|---|---|
| [`ESTANDAR.md`](ESTANDAR.md) | norma única (estructura, 12 leyes, sync, contratos, seguridad, testing, puertos, renderShell, patches) |
| [`docs/PLAN-ecosistema.md`](docs/PLAN-ecosistema.md) | plan aprobado del ecosistema (fases 0–12) |
| `profile/` | perfil DSH (cordis.patch.yml, package.json) |
| `tools/` | ssh-run, sftp-secrets, deploy-pull, doctor (Deno) |
| `install.sh` | reproduce el VPS limpio |

## Reglas de operación

- Código: local → `git push`; VPS → `git pull --recurse-submodules`. Nunca SFTP de código.
- Solo `secrets.json` y `env.json` viajan por SFTP (`sftp-secrets`).
- Patches solo por script; nunca push desde el VPS salvo indicación; backup antes de tocar `db/`.
- Verificar antes de cortar servicios.
