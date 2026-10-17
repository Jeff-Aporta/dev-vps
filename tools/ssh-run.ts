// tools/ssh-run.ts — ejecuta un comando en el VPS (o lee el script por stdin).
//   deno run -A tools/ssh-run.ts "uptime"
//   Get-Content script.sh -Raw | deno run -A tools/ssh-run.ts
import { loadVps, ssh } from "./lib.ts";

const script = Deno.args.join(" ") || await new Response(Deno.stdin.readable).text();
if (!script.trim()) { console.error("uso: ssh-run.ts <comando>  (o pipe del script)"); Deno.exit(2); }
const v = await loadVps();
console.log(await ssh(v, script));
