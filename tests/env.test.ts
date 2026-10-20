import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { resolve } from "node:path";
import { loadEnv, resolveRefs, SECRET_REF } from "../env/mod.ts";

Deno.test("resolveRefs resuelve $secret: y conserva lo demás", () => {
  const secrets = { erp: { jwtSecret: "s3cret", adminPassword: "p4ss" }, nested: [1, 2] };
  const v = resolveRefs({
    a: "$secret:erp.jwtSecret",
    b: "literal",
    c: { d: "$secret:erp.adminPassword", n: 5, arr: ["$secret:erp.jwtSecret"] },
  }, secrets);
  assertEquals(v, { a: "s3cret", b: "literal", c: { d: "p4ss", n: 5, arr: ["s3cret"] } });
});

Deno.test("loadEnv valida, resuelve db.root relativo y secretos", async () => {
  const dir = await Deno.makeTempDir({ prefix: "env-test" });
  try {
    await Deno.writeTextFile(dir + "/env.json", JSON.stringify({
      app: "erp-sqlite-api", port: 8091,
      db: { root: "data" },
      secrets: { jwtSecret: "$secret:erp.jwtSecret", adminPassword: "$secret:erp.adminPassword" },
    }));
    await Deno.writeTextFile(dir + "/secrets.json", JSON.stringify({ erp: { jwtSecret: "s3cret", adminPassword: "p4ss" } }));
    const { env, secretsPath } = await loadEnv({ envPath: dir + "/env.json" });
    assertEquals(env.app, "erp-sqlite-api");
    assertEquals(env.port, 8091);
    assertEquals(env.host, "127.0.0.1");
    assertEquals((env.db as any).root, resolve(dir, "data")); // relativo al env.json
    assertEquals((env as any).secrets.jwtSecret, "s3cret");
    assertEquals(secretsPath?.endsWith("secrets.json"), true);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadEnv falla si falta un $secret", async () => {
  const dir = await Deno.makeTempDir({ prefix: "env-test" });
  try {
    await Deno.writeTextFile(dir + "/env.json", JSON.stringify({ app: "x", port: 1, secrets: { a: "$secret:no.existe" } }));
    await Deno.writeTextFile(dir + "/secrets.json", JSON.stringify({}));
    await assertRejects(() => loadEnv({ envPath: dir + "/env.json" }), Error, "no existe");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("loadEnv falla si falta port", async () => {
  const dir = await Deno.makeTempDir({ prefix: "env-test" });
  try {
    await Deno.writeTextFile(dir + "/env.json", JSON.stringify({ app: "x" }));
    await assertRejects(() => loadEnv({ envPath: dir + "/env.json" }));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
