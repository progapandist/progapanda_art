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
// Warm what visitors actually fetch. Every breakpoint in avif — that is what
// all but a sliver of browsers pick — and the webp/jpg fallbacks only at the
// widths the pages name directly. A fallback miss costs one visitor one encode.
const combos = [];
for (const w of works) {
  const add = (width, format) => combos.push({ slug: w.slug, width, format, version: w.hash });
  for (const width of BREAKPOINTS) add(width, "avif");
  for (const format of ["webp", "jpg"]) {
    add(480, format); // grid tile
    add(1920, format); // hero <img> src
    add(3200, format); // lightbox, and the jpg download
  }
  add(1200, "jpg"); // og:image
  add(3200, "png"); // download
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
