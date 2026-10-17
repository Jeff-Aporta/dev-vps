// tools/lib.ts — ayuda común para las herramientas de VPS (ssh/scp con llave).
// Lee secrets.json (vps.host/user/port + ssh.keyPath) y ejecuta por ssh con clave.
import { dirname, join } from "node:path";

export interface Vps { host: string; user: string; port: number; key?: string; }

export async function findSecretsPath(): Promise<string> {
  const arg = Deno.args.find((a) => a.startsWith("--secrets="));
  if (arg) return arg.slice("--secrets=".length);
  const env = Deno.env.get("SECRETS_JSON");
  if (env) return env;
  let dir = Deno.cwd();
  for (let i = 0; i < 8; i++) {
    const cand = join(dir, "secrets.json");
    try { if ((await Deno.stat(cand)).isFile) return cand; } catch { /* subir */ }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("no se encontró secrets.json (usa --secrets=<ruta> o SECRETS_JSON)");
}

export async function loadVps(): Promise<Vps> {
  const s = JSON.parse(await Deno.readTextFile(await findSecretsPath())) as Record<string, any>;
  return {
    host: s.vps?.host ?? "166.1.85.205",
    user: s.vps?.user ?? "root",
    port: s.vps?.port ?? 22,
    key: s.ssh?.keyPath,
  };
}

function sshArgs(v: Vps, extra: string[]): string[] {
  return [
    "-p", String(v.port),
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=15",
    "-o", "StrictHostKeyChecking=accept-new",
    ...(v.key ? ["-i", v.key] : []),
    ...extra,
  ];
}

/** Ejecuta `script` en el VPS y devuelve su stdout (falla si el exit code ≠ 0). */
export async function ssh(v: Vps, script: string): Promise<string> {
  const r = await new Deno.Command("ssh", { args: [...sshArgs(v, []), `${v.user}@${v.host}`, script], stdout: "piped", stderr: "piped" }).output();
  const out = new TextDecoder().decode(r.stdout);
  const err = new TextDecoder().decode(r.stderr);
  if (!r.success) throw new Error(`ssh ${v.user}@${v.host} falló:\n${err || out}`);
  return out.trim();
}

/** Copia un archivo local → VPS (scp). */
export async function scpTo(v: Vps, from: string, to: string): Promise<void> {
  const r = await new Deno.Command("scp", { args: [...sshArgs(v, ["-q"]), from, `${v.user}@${v.host}:${to}`], stdout: "piped", stderr: "piped" }).output();
  if (!r.success) throw new Error(`scp falló:\n${new TextDecoder().decode(r.stderr)}`);
}
