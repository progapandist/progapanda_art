# progapanda_art

A static site for Andy Barnow's paintings. No framework, no bundler, no
database — Bun for local dev, a small Bun script that generates static HTML,
imgproxy for on-the-fly image resizing, Cloudflare Pages for hosting.

## Editing a work

Add, remove, or replace a file in the sources folder (`SOURCES_DIR` in the
Makefile) and run `make dist` — the list of works is scraped from that
folder every build. `content.md` holds the copy (year, location, medium,
dimensions, availability, description) as one `## <filename>` section per
work; the build adds a stub section for a new file and drops the section for
a deleted one automatically. Fill in a stub by hand.

`about.md` is site-wide copy (artist name, bio) — one file, not per-work,
rendered at `/artist/`.

## Local dev

```
make run-imgproxy   # imgproxy container, in one terminal
make dev            # build --watch + dev server, in another
```

Local dev always builds against the local imgproxy container
(`IMGPROXY_ENDPOINT` is required, never defaults — see build.js); deploy
always builds against production. Mixing the two up silently isn't possible.

## Deploy

```
make deploy             # deploy-imgproxy + deploy-frontend
make deploy-frontend    # frontend: tests, build against prod, wrangler pages deploy
make deploy-imgproxy    # droplet: rsync the sources folder, restart imgproxy + caddy
```

imgproxy signs every URL at build time (`IMGPROXY_KEY`/`IMGPROXY_SALT` in
`.env`, gitignored) — the salt never ships to the browser, only finished
signed URLs do.

Images don't hit the droplet directly in production: `cdn-worker/` is a tiny
Cloudflare Worker reverse proxy in front of `imgproxy.progapanda.org`, giving
it Cloudflare's edge cache even though `progapanda.org`'s DNS isn't on
Cloudflare. Redeploy it with `cd cdn-worker && wrangler deploy` if it ever
changes; the frontend build points at its URL (`PROD_IMGPROXY` in the
Makefile), not at the droplet.
