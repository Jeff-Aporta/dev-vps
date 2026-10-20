# AGENTS.md — dsh-dev-vps (CI/CD del ecosistema VPS)

> **Norma única:** [ESTANDAR](https://github.com/Jeff-Aporta/dsh-dev-vps/blob/main/ESTANDAR.md). Gana sobre este archivo.

## Herramientas (Deno)

| Tool | Qué hace |
|---|---|
| `deno run -A tools/ssh-run.ts "<cmd>"` | ejecuta un comando en el VPS (o por stdin) |
| `deno run -A tools/sftp-secrets.ts` | sube secrets.json (o `--env <local> <destino>`) |
| `deno run -A tools/deploy-pull.ts <ruta> <servicio>` | pull + gate + restart + rollback en el VPS |
| `deno run -A tools/doctor.ts` | salud: deno, puertos, servicios, disco |

## Reglas del agente (no negociables)

1. **Patches solo por script** (`deno task patch`); nunca editar el esquema a mano.
2. **Nunca push desde el VPS** salvo indicación explícita.
3. **Backup antes de tocar `db/`** (sync:db:* ya respalda; si es manual, copiar antes).
4. **Verificar antes de cortar servicios**: `doctor`, `curl`, `systemctl status`; rollback listo.
5. **Código viaja por git** (push local → pull VPS); **solo** `secrets.json`/`env.json` por SFTP.
6. **Commit/push selectivo**: solo lo necesario, gate en verde, sin secretos, y fijar el consumidor al SHA nuevo.
