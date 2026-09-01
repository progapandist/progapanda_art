// Dev server: serves dist/ plus live reload. No bundler, no build step of its
// own — run `make dist` (or keep it running via `make dev`) whenever
// content/ or style.css changes, and this reloads the browser. Same shape as
// tja-web's server.js.
import { watch } from "node:fs";

const sockets = new Set();
const live = `<script>new WebSocket("ws://"+location.host+"/live").onmessage=()=>location.reload()</script>`;

// Watches "." rather than "dist" directly: build.js now finishes a rebuild
// by renaming dist/ out of the way and renaming the freshly-built
// directory into its place (see build.js for why — an atomic swap instead
// of a wipe-and-rewrite-in-place, so a request never hits a half-built
// dist/). A watch rooted at "dist" doesn't survive that — the path it's
// watching gets replaced out from under it, and reload silently stops
// firing. Watching the stable parent instead means the watch itself never
// has to survive anything; only the events crossing it change. dist.tmp/
// and dist.old/ are excluded so mid-build and about-to-be-deleted files
// don't trigger a reload for content nobody's looking at.
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
  port: Number(process.env.PORT) || 3000,
  websocket: { open: (s) => sockets.add(s), close: (s) => sockets.delete(s), message() {} },
  async fetch(req, server) {
    // pathname is percent-encoded as it came in off the wire (e.g. a space
    // in a slug is "%20") — dist/ directories are named with the literal,
    // decoded characters, so this has to match before hitting the filesystem.
    const path = decodeURIComponent(new URL(req.url).pathname);
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
