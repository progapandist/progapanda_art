import { afterAll, beforeAll, expect, test } from "bun:test";

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server, root;
const origin = "http://127.0.0.1:19317";
beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "art-server-"));
  mkdirSync(join(root, "dist/artist"), { recursive: true });
  for (const [path, text] of Object.entries({ "index.html": "home", "artist/index.html": "artist", "style.css": "body {}", "404.html": "not found" })) {
    writeFileSync(join(root, "dist", path), text);
  }
  server = Bun.spawn([process.execPath, "run", new URL("./server.js", import.meta.url).pathname], {
    cwd: root,
    env: { ...process.env, PORT: "19317" }, stdout: "ignore", stderr: "inherit",
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try { await fetch(origin); return; } catch { await Bun.sleep(20); }
  }
  throw new Error("Dev server did not start");
});
afterAll(async () => {
  server?.kill();
  if (server) await server.exited;
  rmSync(root, { recursive: true, force: true });
});

test("serves pages, assets and missing routes", async () => {
  for (const path of ["/", "/artist/", "/style.css"]) {
    expect((await fetch(origin + path)).status).toBe(200);
  }
  const missing = await fetch(origin + "/does-not-exist");
  expect(missing.status).toBe(404);
  expect(await missing.text()).toContain("not found");
});

test("rejects malformed encodings and encoded traversal", async () => {
  for (const path of ["/%ZZ", "/%2e%2e%2f.env", "/%00"]) {
    expect((await fetch(origin + path)).status).toBe(400);
  }
});
