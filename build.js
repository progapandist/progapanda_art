// The build: content/*.md -> dist/. Every imgproxy URL is signed here, once,
// so the salt never has to leave this machine — the deployed HTML only ever
// holds finished, signed URLs. Same idea as tja-web's stamp.js: write the
// pages, content-hash the assets, done.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { loadWorks, loadAbout, urlSlug, escape, renderDescription } from "./content.js";
import { imgproxyUrl, placeholder, BREAKPOINTS, FORMATS } from "./imgproxy.js";

const SITE = process.env.SITE || "https://art.progapanda.org";
// Cloudflare Web Analytics site token — not a secret (it ships in plain
// HTML on every page by design, same as pasting the snippet manually).
const CF_ANALYTICS_TOKEN = "7ea997cc094c44ff95757e808d509065";
// No default: local dev must build against the local imgproxy container and
// production must build against the production one, and getting that mixed
// up silently would mean shipping localhost URLs or previewing 404s. The
// Makefile sets this explicitly for every target — see dev/dist/deploy.
const ENDPOINT = process.env.IMGPROXY_ENDPOINT;
// Placeholder bytes are fetched by this machine at build time, never by a
// visitor's browser, so they can always go straight to the real imgproxy
// origin — bypassing the same-origin /i/ proxy production URLs use, which
// doesn't exist to fetch from until *this* deploy finishes anyway.
const ORIGIN = process.env.IMGPROXY_ORIGIN || ENDPOINT;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const CONTENT_PATH = "content.md";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;
const about = loadAbout("about.md");
const ARTIST = about.data.artist || "Andy Barnow";
// The header brand lockup — can read differently from ARTIST, which is
// still what page titles, OG tags and the artist page heading use.
const WORDMARK = about.data.wordmark || ARTIST;
const dist = "dist/";

if (!ENDPOINT) throw new Error("IMGPROXY_ENDPOINT must be set — see Makefile (dev/dist target local, deploy target production).");
if (!KEY || !SALT) {
  throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env) — signing needs both.");
}

const img = (work, width, format) =>
  imgproxyUrl({ endpoint: ENDPOINT, key: KEY, salt: SALT, slug: work.slug, width, format, version: work.hash });

const srcset = (work, format) => BREAKPOINTS.map((w) => `${img(work, w, format)} ${w}w`).join(", ");

// Fetching a source image is nearly as expensive as fetching any resize of
// it — imgproxy has to decode the whole thing regardless of target size —
// so 45 placeholder fetches in parallel would pile onto the same origin the
// real thumbnails already load. A small worker pool caps that; a per-slug
// cache means a --watch rebuild only ever fetches a placeholder once.
const placeholderCache = new Map();

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function loadPlaceholders(works) {
  const placeholders = new Map();
  await mapLimit(works, 4, async (w) => {
    if (!placeholderCache.has(w.slug)) {
      placeholderCache.set(
        w.slug,
        await placeholder({ endpoint: ORIGIN, key: KEY, salt: SALT, slug: w.slug }).catch(() => null),
      );
    }
    placeholders.set(w.slug, placeholderCache.get(w.slug));
  });
  return placeholders;
}

// ---- shared page shell -----------------------------------------------------
// "home" drops the "all works" link (it would just point at itself); every
// other page carries both.
function layout({ title, description, canonical, ogImage, body, active, preload }) {
  const links = [
    `<a class="contrib" href="/artist/">artist</a>`,
    active !== "home" && `<a class="contrib" href="/">all works</a>`,
    `<button class="theme-toggle" type="button" aria-label="switch to dark">&#9679;</button>`,
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="${escape(description)}">
${preload || ""}
<link rel="canonical" href="${canonical}">
<title>${escape(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(ARTIST)}">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${ogImage}">` : ""}
<link rel="icon" href="data:,">
<!-- Classic script, not a module: runs and blocks before the stylesheet
     is even parsed, so a saved theme choice applies before first paint —
     a module here would run too late and flash the wrong theme first. -->
<script src="${STAMPED.theme}"></script>
<link rel="stylesheet" href="${STAMPED.css}">
<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CF_ANALYTICS_TOKEN}"}'></script>
</head>
<body>
<header>
  <h1 class="wordmark"><a href="/">${escape(WORDMARK)}</a></h1>
  <nav class="header-nav">${links}</nav>
</header>
${body}
<script type="module" src="${STAMPED.nav}"></script>
</body>
</html>
`;
}

// ---- the grid / home page ---------------------------------------------------
function gridPage(works, placeholders) {
  const tiles = works
    .map((w) => {
      const ph = placeholders.get(w.slug);
      const style = ph ? ` style="background-image:url('${ph}')"` : "";
      return `  <a class="tile" href="/works/${encodeURIComponent(urlSlug(w.slug))}/"${style}>
    <img src="${img(w, 480, "avif")}" alt="${escape(w.title)}" loading="lazy">
    <span class="tile-info">
      <span class="tile-title">${escape(w.title)}</span>
      <span class="tile-meta">${escape([w.location, w.year].filter(Boolean).join(", "))}</span>
    </span>
  </a>`;
    })
    .join("\n");

  const body = `<main>
  <div class="tiles">
${tiles}
  </div>
</main>
<footer class="grid-foot">
  <p>${works.length} works &middot; Berlin</p>
</footer>`;

  return layout({
    title: `${ARTIST} — paintings`,
    description: `Paintings by ${ARTIST}, Berlin. ${works.length} works.`,
    canonical: `${SITE}/`,
    ogImage: works.length ? img(works[0], 1200, "jpg") : null,
    body,
    active: "home",
  });
}

// ---- the artist page ---------------------------------------------------------
function artistPage() {
  const body = `<main class="work">
  <div class="work-body work-body-solo">
    <h2 class="title">${escape(ARTIST)}</h2>
    <p class="description">${escape(about.body)}</p>
  </div>
</main>`;

  return layout({
    title: `${ARTIST} — artist`,
    description: about.body || ARTIST,
    canonical: `${SITE}/artist/`,
    ogImage: null,
    body,
    active: "artist",
  });
}

// ---- a work page -------------------------------------------------------------
function dimensionsText(work) {
  if (!work.dimensions.length) return null;
  return work.dimensions.filter((n) => n !== null && n !== undefined).join(" × ") + " cm";
}

function workPage(work, prev, next, ph) {
  const dims = dimensionsText(work);
  const rows = [
    work.location && ["location", escape(work.location)],
    work.year && ["year", escape(work.year)],
    dims && ["dimensions", escape(dims)],
    work.availability && ["availability", `<span class="availability">${escape(work.availability)}${work.price ? ` &middot; €${escape(work.price)}` : ""}</span>`],
  ].filter(Boolean);

  const forms = rows.length
    ? `<dl class="forms">
${rows.map(([k, v]) => `    <dt>${k}</dt><dd>${v}</dd>`).join("\n")}
  </dl>`
    : "";

  const medium = work.medium.length
    ? `<ul class="chips">${work.medium.map((m) => `<li>${escape(m)}</li>`).join("")}</ul>`
    : "";

  const description = work.description ? `<div class="description">${renderDescription(work.description)}</div>` : "";

  // class="format-link": nav.js intercepts a plain click on these to open
  // the lightbox instead of navigating — href still points straight at the
  // real image, so a modified click (new tab, save-as, no-JS) behaves
  // exactly like a normal link regardless.
  const formats = `<ul class="chips">${FORMATS.map((f) => `<li><a class="format-link" href="${img(work, 3200, f)}">${f}</a></li>`).join("")}</ul>`;

  // Medium above full resolution, as a column of its own next to the
  // location/year/dimensions/availability column — not stacked as more
  // text underneath the form. Description (if any) runs full-width below
  // this row, since it doesn't pair one-to-one with either column.
  // Reuses .forms' own dt/dd row layout rather than a separate stacked
  // label-then-content block — label next to its content, same as
  // location/year/etc. in the left column, not label above content.
  const sideCol = `<dl class="forms side-col">
    ${medium ? `<dt>medium</dt><dd>${medium}</dd>` : ""}
    <dt>full resolution</dt><dd>${formats}</dd>
  </dl>`;

  const pager = `<nav class="pager">
    ${prev ? `<a rel="prev" href="/works/${encodeURIComponent(urlSlug(prev.slug))}/">&larr; ${escape(prev.title)}</a>` : `<span></span>`}
    ${next ? `<a class="next" rel="next" href="/works/${encodeURIComponent(urlSlug(next.slug))}/">${escape(next.title)} &rarr;</a>` : `<span></span>`}
  </nav>`;

  // Same object-fit: contain box as the real image, layered directly
  // underneath it — not a cover-cropped background peeking around the
  // letterbox edges. The real <img> naturally paints over it once loaded;
  // no JS needed to hide it.
  const placeholderImg = ph ? `<img class="placeholder" src="${ph}" alt="" aria-hidden="true">` : "";
  const body = `<main class="work">
  <div class="frame">
    ${placeholderImg}
    <picture>
      <source type="image/avif" srcset="${srcset(work, "avif")}" sizes="100vw">
      <source type="image/webp" srcset="${srcset(work, "webp")}" sizes="100vw">
      <img src="${img(work, 1920, "jpg")}" srcset="${srcset(work, "jpg")}" sizes="100vw" alt="${escape(work.title)}" loading="eager" fetchpriority="high">
    </picture>
    <div class="nav-hint" aria-hidden="true">
      <span class="hint-zone hint-right"></span>
      <span class="hint-zone hint-left"></span>
      <span class="hint-zone hint-center"></span>
    </div>
  </div>
  <div class="work-body">
    <h2 class="title">${escape(work.title)}</h2>
    <div class="work-columns">
      ${forms}
      ${sideCol}
    </div>
    ${description}
  </div>
  ${pager}
</main>
<div class="lightbox" aria-hidden="true">
  <div class="lightbox-backdrop"></div>
  <div class="lightbox-viewport">
    <img class="lightbox-img" alt="">
  </div>
  <button class="lightbox-close" type="button" aria-label="close">&times;</button>
</div>`;

  // The hero image is the LCP element on this page — a preload hint lets the
  // browser start fetching it while still parsing <head>, instead of only
  // discovering the URL once it reaches the <picture> in the body.
  const preload = `<link rel="preload" as="image" imagesrcset="${srcset(work, "avif")}" imagesizes="100vw" fetchpriority="high" type="image/avif">`;

  return layout({
    title: `${escape(work.title)} — ${ARTIST}`,
    description: work.description || `${work.title}, ${[work.location, work.year].filter(Boolean).join(", ")}.`,
    canonical: `${SITE}/works/${encodeURIComponent(urlSlug(work.slug))}/`,
    ogImage: img(work, 1200, "jpg"),
    body,
    active: "work",
    preload,
  });
}

function notFoundPage() {
  return layout({
    title: `Not found — ${ARTIST}`,
    description: "Page not found.",
    canonical: `${SITE}/404.html`,
    ogImage: null,
    body: `<main class="work"><div class="work-body work-body-solo"><h2 class="title">not found</h2><p class="description"><a href="/">back to all works</a></p></div></main>`,
    active: "404",
  });
}

// ---- write -------------------------------------------------------------------
let STAMPED;

async function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  // Assets first, content-hashed, so the page templates above can reference
  // the stamped URL (computed before any HTML is generated).
  const hash = (path) => createHash("md5").update(readFileSync(path)).digest("hex").slice(0, 8);
  STAMPED = {
    css: `/style.css?v=${hash("style.css")}`,
    nav: `/nav.js?v=${hash("nav.js")}`,
    theme: `/theme.js?v=${hash("theme.js")}`,
  };
  cpSync("style.css", dist + "style.css");
  cpSync("nav.js", dist + "nav.js");
  cpSync("theme.js", dist + "theme.js");
  cpSync("_headers", dist + "_headers");
  cpSync("_redirects", dist + "_redirects");
  cpSync("robots.txt", dist + "robots.txt");

  const works = loadWorks(SOURCES_DIR, CONTENT_PATH);
  const placeholders = await loadPlaceholders(works);

  writeFileSync(dist + "index.html", gridPage(works, placeholders));
  writeFileSync(dist + "404.html", notFoundPage());
  mkdirSync(dist + "artist/", { recursive: true });
  writeFileSync(dist + "artist/index.html", artistPage());

  for (let i = 0; i < works.length; i++) {
    const dir = `${dist}works/${urlSlug(works[i].slug)}/`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      dir + "index.html",
      workPage(works[i], works[i - 1] || null, works[i + 1] || null, placeholders.get(works[i].slug)),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/artist/`, priority: "0.5" },
    ...works.map((w) => ({ loc: `${SITE}/works/${encodeURIComponent(urlSlug(w.slug))}/`, priority: "0.8" })),
  ];
  writeFileSync(
    dist + "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`,
  );

  console.log(`dist: ${works.length} works, endpoint ${ENDPOINT}`);
}

await build();

if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  console.log(`watching ${CONTENT_PATH}, style.css, nav.js, ${SOURCES_DIR}...`);
  for (const path of [CONTENT_PATH, "style.css", "nav.js", "theme.js"]) {
    watch(path, () => build());
  }
  // Not recursive: a new or deleted file directly in the sources folder is
  // what changes the work list; edits inside it don't matter here.
  watch(SOURCES_DIR, () => build());
}
