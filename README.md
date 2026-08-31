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

`about.md` is site-wide copy (artist name, credit line, bio) — one file, not
per-work.

## Local dev

```
make run-imgproxy   # imgproxy container, in one terminal
make dev            # build --watch + dev server, in another
```

`make preview` does the same but points the build at the local imgproxy
container instead of production, so newly-added images that haven't been
deployed yet still render.

## Deploy

```
make deploy            # frontend: tests, build, wrangler pages deploy
make deploy-imgproxy    # droplet: rsync the sources folder, restart imgproxy + caddy
```

imgproxy signs every URL at build time (`IMGPROXY_KEY`/`IMGPROXY_SALT` in
`.env`, gitignored) — the salt never ships to the browser, only finished
signed URLs do.
