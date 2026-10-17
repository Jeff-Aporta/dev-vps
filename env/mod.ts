// env — carga y validación común de `env.json` (norma única del ecosistema VPS).
// Se consume por CDN con SHA40 (nunca @main):
//   import { loadEnv, EnvBaseSchema } from "https://cdn.jsdelivr.net/gh/Jeff-Aporta/dev-vps@<sha40>/env/mod.ts";
//
// `env.json` es por host (gitignored); `env.example.json` se versiona. Los secretos NO van en
// env.json: se referencian como "$secret:<ruta>" y se resuelven desde `secrets.json` en tiempo
// de arranque. Ambos archivos son lo único que viaja por SFTP (ley 9).
import { z } from "zod";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** Un valor "$secret:ruta" apunta a secrets.json (ej. "$secret:erp.jwtSecret" → secrets.erp.jwtSecret). */
export const SECRET_REF = /^\$secret:([A-Za-z0-9_][A-Za-z0-9_.-]*)$/;

/** Campos comunes a toda API del ecosistema. `.passthrough()` deja pasar lo específico de cada app. */
export const EnvBaseSchema = z.object({
  app: z.string().min(1, "env.json: falta 'app'"),
  port: z.number().int().positive("env.json: 'port' debe ser un entero positivo"),
  host: z.string().min(1).default("127.0.0.1"),
  db: z.object({ root: z.string().min(1, "env.json: falta 'db.root'") }).passthrough().default({ root: "." }),
  peers: z.record(z.string(), z.string()).default({}),
  exposeErrors: z.boolean().default(false),
  secrets: z.record(z.string(), z.string()).default({}),
}).passthrough();

export type EnvBase = z.infer<typeof EnvBaseSchema> & Record<string, unknown>;

function getAt(secrets: unknown, path: string): unknown {
  let cur = secrets;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function resolveRefs(value: unknown, secrets: unknown): unknown {
  if (typeof value === "string") {
    const m = value.match(SECRET_REF);
    if (m) {
      const v = getAt(secrets, m[1]);
      if (v === undefined) throw new Error(`env.json: $secret:${m[1]} no existe en secrets.json`);
      return v;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((x) => resolveRefs(x, secrets));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveRefs(v, secrets);
    return out;
  }
  return value;
}

async function findSecrets(startDir: string, explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;
  let dir = resolve(startDir);
  for (let i = 0; i < 8; i++) {
    const cand = join(dir, "secrets.json");
    try { if ((await Deno.stat(cand)).isFile) return cand; } catch { /* subir */ }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export interface LoadEnvOptions {
  envPath?: string;      // default: $ENV_JSON o ./env.json
  secretsPath?: string;  // default: buscar secrets.json hacia arriba desde env.json
  schema?: z.ZodType;    // esquema específico de la app, se aplica encima del base
}

export interface LoadedEnv {
  env: EnvBase;
  envPath: string;
  secretsPath?: string;
}

export async function loadEnv(opts: LoadEnvOptions = {}): Promise<LoadedEnv> {
  const envPath = opts.envPath ?? Deno.env.get("ENV_JSON") ?? join(Deno.cwd(), "env.json");
  const baseDir = dirname(resolve(envPath));
  const raw = await Deno.readTextFile(envPath);
  let parsed = EnvBaseSchema.parse(JSON.parse(raw));
  if (opts.schema) parsed = opts.schema.parse(parsed) as EnvBase;

  const dbRoot = parsed.db.root as string;
  if (!isAbsolute(dbRoot)) parsed.db.root = resolve(baseDir, dbRoot);

  const secretsPath = await findSecrets(baseDir, opts.secretsPath);
  let secrets: unknown = {};
  if (secretsPath) {
    try { secrets = JSON.parse(await Deno.readTextFile(secretsPath)); }
    catch (e) { throw new Error(`env.json: no se pudo leer ${secretsPath}: ${(e as Error).message}`); }
  }
  const env = resolveRefs(parsed, secrets) as EnvBase;
  return { env, envPath, secretsPath };
}
