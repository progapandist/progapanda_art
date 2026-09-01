// Hits every URL the site can actually generate, through the SAME public
// path a real visitor's browser uses (art.progapanda.org/i/... — the
// Cloudflare Pages Function that reverse-proxies + edge-caches imgproxy).
// That's deliberate: imgproxy's own result cache is a Pro-only feature,
// not present on the open-source build this droplet runs — confirmed by
// testing (the exact same signed URL, fetched twice, took the same ~2s
// both times, and the "cache" directory stayed empty). There is no
// origin-side caching to warm, full stop. Cloudflare's edge cache is the
// only cache that actually helps, and it only activates for requests that
// go through the /i/ proxy — hitting imgproxy directly (its own domain, or
// over the droplet's internal Docker network) never touches it, which is
// exactly what this script used to do and why it never sped anything up.
//
// Every visit still pays imgproxy's real CPU-bound encode cost once per
// (work, breakpoint, format) per Cloudflare PoP — this can't eliminate
// that, only move it here instead of onto whoever happens to be the first
// visitor from a given region. Also doubles as a smoke test: a slug that
// 404s or a processing option imgproxy doesn't actually support (both have
// happened) shows up here before a visitor ever sees it.
import { loadWorks } from "./content.js";
import { imgproxyUrl, BREAKPOINTS } from "./imgproxy.js";

const ENDPOINT = process.env.IMGPROXY_ENDPOINT;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;

if (!ENDPOINT) throw new Error("IMGPROXY_ENDPOINT must be set — the public /i/ URL, not the droplet directly.");
if (!KEY || !SALT) throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env).");

const works = loadWorks(SOURCES_DIR, "content.md");

// Every combination build.js actually embeds in the HTML — not the full
// cross-product of BREAKPOINTS × FORMATS. The picture srcset only ever asks
// for avif/webp/jpg (at every breakpoint); png only appears once, in the
// format-download row, always at the largest width (3200, already one of
// the breakpoints). png at the other six breakpoints is a URL nobody's
// browser will ever request, and it's the slowest, most memory-hungry
// format to encode at a large size — pure waste that only made the real
// combos wait longer behind it.
const PICTURE_FORMATS = ["avif", "webp", "jpg"];
const combos = [];
for (const w of works) {
  // version carries the work's content hash through to imgproxyUrl() —
  // without it these URLs wouldn't match what build.js actually embeds in
  // the HTML (see imgproxy.js), and this would warm cache entries no
  // visitor's browser ever requests instead of the real ones.
  for (const width of BREAKPOINTS) for (const format of PICTURE_FORMATS) combos.push({ slug: w.slug, width, format, version: w.hash });
  combos.push({ slug: w.slug, width: 3200, format: "png", version: w.hash });
  combos.push({ slug: w.slug, width: 1200, format: "jpg", version: w.hash });
}

async function mapLimit(items, limit, fn) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
}

console.log(`warming ${combos.length} urls (${works.length} works) through ${ENDPOINT}...`);
let done = 0;
let misses = 0;
const started = Date.now();

// The droplet has 2 vCPUs — every request still bottlenecks on imgproxy's
// own CPU-bound encode there regardless of which door it came in through,
// so concurrency past that just means requests queue and wait, not that
// more work happens in parallel.
await mapLimit(combos, 2, async (c) => {
  const url = imgproxyUrl({ endpoint: ENDPOINT, key: KEY, salt: SALT, ...c });
  // Without a timeout, one genuinely hung connection parks a worker slot
  // forever, stalling the whole run permanently — indistinguishable from
  // "just slow" until someone gives up waiting on it.
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  done++;
  if (!res || !res.ok) {
    misses++;
    console.log(`  miss: ${c.slug} ${c.width}w ${c.format} -> ${res?.status ?? "timeout/network error"}`);
  }
  if (done % 10 === 0) console.log(`  ${done}/${combos.length}`);
});

console.log(`done: ${done} warmed, ${misses} misses, ${((Date.now() - started) / 1000).toFixed(0)}s`);
