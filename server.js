import { watch } from "node:fs";

const sockets = new Set();
const live = `<script>new WebSocket("ws://"+location.host+"/live").onmessage=()=>location.reload()</script>`;
watch(".", { recursive: true }, (event, filename) => {
  if (!filename) return;
  if (filename !== "dist" && !filename.startsWith("dist/")) return;
  for (const s of sockets) s.send("reload");
});

async function resolve(pathname) {
  if (pathname.endsWith("/")) return Bun.file(`dist${pathname}index.html`);
  const direct = Bun.file(`dist${pathname}`);
  if (await direct.exists()) return direct;
  return Bun.file(`dist${pathname}/index.html`);
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT) || 3000,
  websocket: { open: (s) => sockets.add(s), close: (s) => sockets.delete(s), message() {} },
  async fetch(req, server) {
    let path;
    try { path = decodeURIComponent(new URL(req.url).pathname); }
    catch { return new Response("Invalid URL", { status: 400 }); }
    if (path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) {
      return new Response("Invalid path", { status: 400 });
    }
    if (path === "/live") return server.upgrade(req) ? undefined : new Response("expected websocket", { status: 400 });

    const file = await resolve(path);
    if (!(await file.exists())) {
      return new Response((await Bun.file("dist/404.html").text()) + live, {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (file.name.endsWith(".html")) {
      return new Response((await file.text()) + live, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response(file);
  },
});

console.log(`progapanda_art → http://localhost:${server.port}`);
