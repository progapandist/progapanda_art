// Pre-warms imgproxy's origin fs cache with every URL the site can actually
// generate, so the first real visitor to hit a given work/breakpoint/format
// never pays the multi-second AVIF-encode-from-a-60MB-source cost a cold
// cache has — that cost lands here, once, instead. Run after deploy-imgproxy
// (new works, or a config change like IMGPROXY_JPEG_PROGRESSIVE that makes
// every previously-cached result stale) — not on every routine deploy.
import { loadWorks } from "./content.js";
import { imgproxyUrl, BREAKPOINTS, FORMATS } from "./imgproxy.js";

const ORIGIN = process.env.IMGPROXY_ORIGIN;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;

if (!ORIGIN) throw new Error("IMGPROXY_ORIGIN must be set.");
if (!KEY || !SALT) throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env).");

const works = loadWorks(SOURCES_DIR, "content.md");

// Every combination build.js actually embeds in the HTML: the full
// breakpoint/format grid (picture srcsets + format-download links), plus the
// one OG width that isn't otherwise in the breakpoint list.
const combos = [];
for (const w of works) {
  for (const width of BREAKPOINTS) for (const format of FORMATS) combos.push({ slug: w.slug, width, format });
  combos.push({ slug: w.slug, width: 1200, format: "jpg" });
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

console.log(`warming ${combos.length} urls (${works.length} works) against ${ORIGIN}...`);
let done = 0;
let misses = 0;
const started = Date.now();

await mapLimit(combos, 6, async (c) => {
  const url = imgproxyUrl({ endpoint: ORIGIN, key: KEY, salt: SALT, ...c });
  // Without a timeout, one genuinely hung connection parks a worker slot
  // forever — with 6 workers, six unlucky hangs stalls the whole run
  // permanently, indistinguishable from "just slow" until someone gives up
  // waiting on it.
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  done++;
  if (!res || !res.ok) {
    misses++;
    console.log(`  miss: ${c.slug} ${c.width}w ${c.format} -> ${res?.status ?? "timeout/network error"}`);
  }
  if (done % 10 === 0) console.log(`  ${done}/${combos.length}`);
});

console.log(`done: ${done} warmed, ${misses} misses, ${((Date.now() - started) / 1000).toFixed(0)}s`);
