# progapanda_art

A static site for Andy Barnow's paintings. No framework, no bundler, no
database — Bun for local dev, a small Bun script that generates static HTML,
imgproxy for on-the-fly image resizing, Cloudflare Pages for hosting.

## Editing a work

Add, remove, or replace a file in the sources folder (`SOURCES_DIR` in the
Makefile) and run `make dist` — the list of works is scraped from that
folder every build. `content.md` holds one `## <filename>` section per work.
New files receive a stub. Missing files are excluded from the site, but their
copy stays in `content.md` with a warning until you restore the source or
remove the section yourself.

The build recognizes unambiguous renames by content hash and preserves their
copy. When renaming and editing an image together, or when duplicate images
exist, rename its heading in `content.md` yourself before building.

`about.md` holds the artist name, wordmark and bio, rendered at `/artist/`.

## Local dev

Requires Bun, Docker, the source-image folder configured in `Makefile`, and
`IMGPROXY_KEY` / `IMGPROXY_SALT` in `.env`. Deployment also requires an
authenticated Wrangler CLI; droplet deployment uses `doctl` and SSH.

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

imgproxy itself has no result cache (that's a Pro-only feature, not on the
open-source build this runs) — every request is a real encode. The only
cache that helps is Cloudflare's edge cache in front of the public `/i/`
proxy, and it only activates for requests that actually go through that
path. `make warm-cache` hits every URL the site generates through that
exact path — not chained into deploy, since a full sweep can take several
minutes; run it yourself when you want to (safe to re-run any time, a new
run kills a still-running previous one first).

Images don't hit the droplet directly in production: `functions/i/[[path]].js`
is a Cloudflare Pages Function that reverse-proxies + edge-caches
`imgproxy.progapanda.org`, deployed automatically alongside the static site
(same `wrangler pages deploy`, no separate step). It's same-origin
(`art.progapanda.org/i/...`) rather than a separate `*.workers.dev` domain —
a shared, third-party-looking CDN domain is exactly what Safari's
tracking/fingerprinting protection reacts to; same-origin sidesteps that
entirely and lets the CSP stay a plain `img-src 'self'`.

## Markdown copy

Work descriptions and the `about.md` body support Markdown: headings,
emphasis, links, email autolinks, nested lists, blockquotes, fenced code,
tables, strikethrough and task lists. Bun's built-in Markdown renderer runs
only during the build; no Markdown package or browser script is added.
Raw HTML is displayed as text.

In `content.md`, begin each work with `## filename` immediately followed by
metadata (for example `year: 2026`), then a blank line and its Markdown body.
Other headings, including `##` headings without metadata beneath them, stay
inside the description. Fenced code can contain section-like headings safely.
Use a current Bun version with `Bun.markdown` support.
