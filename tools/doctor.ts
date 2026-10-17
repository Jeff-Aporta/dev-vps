// tools/doctor.ts — salud del VPS: conectividad, deno, puertos, servicios y disco.
import { loadVps, ssh } from "./lib.ts";

const v = await loadVps();
const SCRIPT = `
set -e
echo "== host =="; hostname; uptime -p
echo "== deno =="; deno --version 2>/dev/null | head -1 || echo "FALTA deno"
echo "== puertos =="; ss -tlnp 2>/dev/null | grep -E ":(8091|8092|8093|8094|9443|80)" || echo "(ninguno de los esperados)"
echo "== servicios =="; systemctl list-units --type=service --all 2>/dev/null | grep -Ei "erp|usrs|admn|dsh|nginx" || echo "(ninguno)"
echo "== disco =="; df -h / | tail -1
echo "== memoria =="; free -h | grep Mem
`;
console.log(await ssh(v, SCRIPT));
