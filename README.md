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

Renaming a file is not the same as add+edit: content.md's reconciliation
matches purely by filename, so a rename looks identical to "delete the old
work, add a new one" — the old section (title, description, everything
written for it) gets dropped and a blank stub appears under the new name.
To keep it, rename the `## old-name` heading in content.md yourself to
match, before running `make dist`/`make deploy`.

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
