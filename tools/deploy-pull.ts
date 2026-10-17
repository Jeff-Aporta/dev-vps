// tools/deploy-pull.ts — en el VPS: git pull --recurse-submodules + gate + restart (rollback si no levanta).
//   deno run -A tools/deploy-pull.ts <ruta> <servicio> [--no-gate]
import { loadVps, ssh } from "./lib.ts";

const [ruta, servicio, ...flags] = Deno.args;
if (!ruta || !servicio) { console.error("uso: deploy-pull.ts <ruta-repo> <servicio-systemd> [--no-gate]"); Deno.exit(2); }
const noGate = flags.includes("--no-gate");
const v = await loadVps();

const SCRIPT = `
set -e
cd ${ruta}
prev=$(git rev-parse HEAD)
git pull -q --ff-only --recurse-submodules
git submodule update --init --recursive -q || true
echo "pull: $prev -> $(git rev-parse HEAD)"
${noGate ? "echo 'gate omitido (--no-gate)'" : "deno task test:all || { echo \"gate rojo: rollback\"; git checkout -q $prev; exit 1; }"}
systemctl restart ${servicio}
for i in $(seq 1 20); do curl -s -o /dev/null http://127.0.0.1:8091/api/permisos && { echo "ok: ${servicio} responde"; exit 0; }; sleep 1; done
echo "✗ ${servicio} no responde: rollback"
git checkout -q $prev && systemctl restart ${servicio}
exit 1
`;
console.log(await ssh(v, SCRIPT));
