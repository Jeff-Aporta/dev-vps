// tools/sftp-secrets.ts — sube secrets.json (y opcionalmente env.json) al VPS por scp.
//   deno run -A tools/sftp-secrets.ts                    # sube secrets.json → /opt/dsh/work/secrets.json
//   deno run -A tools/sftp-secrets.ts --env <ruta> <dest> # sube un env.json concreto
import { loadVps, scpTo, ssh } from "./lib.ts";

const v = await loadVps();
const remoteSecrets = "/opt/dsh/work/secrets.json";

const envIdx = Deno.args.indexOf("--env");
if (envIdx !== -1) {
  const [local, remote] = [Deno.args[envIdx + 1], Deno.args[envIdx + 2]];
  if (!local || !remote) { console.error("uso: sftp-secrets.ts --env <local> <destino-remoto>"); Deno.exit(2); }
  await scpTo(v, local, remote);
  await ssh(v, `chmod 600 ${remote} && echo "✓ ${remote}"`);
  Deno.exit(0);
}

// default: secrets.json local → VPS
const { findSecretsPath } = await import("./lib.ts");
const local = await findSecretsPath();
await scpTo(v, local, remoteSecrets);
await ssh(v, `chmod 600 ${remoteSecrets} && echo "✓ ${remoteSecrets}"`);
