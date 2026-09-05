import { mapLimit } from "./utils.js";
import { loadWorks } from "./content.js";
import { imgproxyUrl, BREAKPOINTS } from "./imgproxy.js";

const ENDPOINT = process.env.IMGPROXY_ENDPOINT;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;

if (!ENDPOINT) throw new Error("IMGPROXY_ENDPOINT must be set — the public /i/ URL, not the droplet directly.");
if (!KEY || !SALT) throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env).");

const works = loadWorks(SOURCES_DIR, "content.md");
const PICTURE_FORMATS = ["avif", "webp", "jpg"];
const combos = [];
for (const w of works) {
  for (const width of BREAKPOINTS) for (const format of PICTURE_FORMATS) combos.push({ slug: w.slug, width, format, version: w.hash });
  combos.push({ slug: w.slug, width: 3200, format: "png", version: w.hash });
  combos.push({ slug: w.slug, width: 1200, format: "jpg", version: w.hash });
}

console.log(`warming ${combos.length} urls (${works.length} works) through ${ENDPOINT}...`);
let done = 0;
let misses = 0;
const started = Date.now();
await mapLimit(combos, 2, async (c) => {
  const url = imgproxyUrl({ endpoint: ENDPOINT, key: KEY, salt: SALT, ...c });
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null);
  if (res?.body) await res.arrayBuffer();
  done++;
  if (!res || !res.ok) {
    misses++;
    console.log(`  miss: ${c.slug} ${c.width}w ${c.format} -> ${res?.status ?? "timeout/network error"}`);
  }
  if (done % 10 === 0) console.log(`  ${done}/${combos.length}`);
});

console.log(`done: ${done} warmed, ${misses} misses, ${((Date.now() - started) / 1000).toFixed(0)}s`);

if (misses) process.exitCode = 1;
