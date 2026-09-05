import { mapLimit } from "./utils.js";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync, renameSync, existsSync } from "node:fs";
import { loadWorks, loadAbout, urlSlug, escape, renderDescription, dimensionsText } from "./content.js";
import { imgproxyUrl, placeholder, BREAKPOINTS, FORMATS } from "./imgproxy.js";

const SITE = process.env.SITE || "https://art.progapanda.org";
const CF_ANALYTICS_TOKEN = "7ea997cc094c44ff95757e808d509065";
const ENDPOINT = process.env.IMGPROXY_ENDPOINT;
const ORIGIN = process.env.IMGPROXY_ORIGIN || ENDPOINT;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const CONTENT_PATH = "content.md";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;
let about, ARTIST, WORDMARK;
const dist = "dist/";
const distTmp = "dist.tmp/";
const distOld = "dist.old/";

if (!ENDPOINT) throw new Error("IMGPROXY_ENDPOINT must be set — see Makefile (dev/dist target local, deploy target production).");
if (!KEY || !SALT) {
  throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env) — signing needs both.");
}

const img = (work, width, format) =>
  imgproxyUrl({ endpoint: ENDPOINT, key: KEY, salt: SALT, slug: work.slug, width, format, version: work.hash });

const srcset = (work, format) => BREAKPOINTS.map((w) => `${img(work, w, format)} ${w}w`).join(", ");
const placeholderCache = new Map();

async function loadPlaceholders(works) {
  const placeholders = new Map();
  await mapLimit(works, 4, async (w) => {
    const cacheKey = `${w.slug}:${w.hash}`;
    if (!placeholderCache.get(cacheKey)) {
      placeholderCache.set(
        cacheKey,
        await placeholder({ endpoint: ORIGIN, key: KEY, salt: SALT, slug: w.slug }).catch(() => null),
      );
    }
    placeholders.set(w.slug, placeholderCache.get(cacheKey));
  });
  return placeholders;
}
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
function gridPage(works, placeholders) {
  const tiles = works
    .map((w) => {
      const ph = placeholders.get(w.slug);
      const style = ph ? ` style="background-image:url('${ph}')"` : "";
      return `  <a class="tile" href="/works/${encodeURIComponent(urlSlug(w.slug))}/"${style}>
    <picture>
      <source type="image/avif" srcset="${img(w, 480, "avif")}">
      <source type="image/webp" srcset="${img(w, 480, "webp")}">
      <img src="${img(w, 480, "jpg")}" alt="${escape(w.title)}" loading="lazy">
    </picture>
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
function artistPage() {
  const body = `<main class="work">
  <div class="work-body work-body-solo">
    <h2 class="title">${escape(ARTIST)}</h2>
    <div class="description">${renderDescription(about.body)}</div>
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
function workPage(work, prev, next, ph) {
  const dims = dimensionsText(work.dimensions);
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
  const formats = `<ul class="chips">${FORMATS.map((f) => `<li><a class="format-link" data-format="${f}" href="${img(work, 3200, f)}">${f}</a></li>`).join("")}</ul>`;
  const sideCol = `<dl class="forms side-col">
    ${medium ? `<dt>medium</dt><dd>${medium}</dd>` : ""}
    <dt>full resolution</dt><dd>${formats}</dd>
  </dl>`;

  const pager = `<nav class="pager">
    ${prev ? `<a rel="prev" href="/works/${encodeURIComponent(urlSlug(prev.slug))}/">&larr; ${escape(prev.title)}</a>` : `<span></span>`}
    ${next ? `<a class="next" rel="next" href="/works/${encodeURIComponent(urlSlug(next.slug))}/">${escape(next.title)} &rarr;</a>` : `<span></span>`}
  </nav>`;
  const heroNavigation = [
    prev && `<a class="hero-arrow hero-prev" href="/works/${encodeURIComponent(urlSlug(prev.slug))}/" aria-label="Previous work: ${escape(prev.title)}" title="Previous work (←)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M16 4 8 12 16 20"/></svg></a>`,
    next && `<a class="hero-arrow hero-next" href="/works/${encodeURIComponent(urlSlug(next.slug))}/" aria-label="Next work: ${escape(next.title)}" title="Next work (→)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 4 16 12 8 20"/></svg></a>`,
  ].filter(Boolean).join("\n");
  const placeholderImg = ph ? `<img class="placeholder" src="${ph}" alt="" aria-hidden="true">` : "";
  const body = `<main class="work">
  <div class="frame">
    ${placeholderImg}
    <picture>
      <source type="image/avif" srcset="${srcset(work, "avif")}" sizes="100vw">
      <source type="image/webp" srcset="${srcset(work, "webp")}" sizes="100vw">
      <img src="${img(work, 1920, "jpg")}" srcset="${srcset(work, "jpg")}" sizes="100vw" alt="${escape(work.title)}" loading="eager" fetchpriority="high">
    </picture>
    ${heroNavigation}
    ${prev || next ? '<p class="keyboard-hint">keyboard <kbd>←</kbd> <kbd>→</kbd> to browse</p>' : ""}
    <div class="nav-hint" aria-hidden="true">
      <span class="hint-zone hint-right"></span>
      <span class="hint-zone hint-left"></span>
      <span class="hint-zone hint-center"></span>
    </div>
  </div>
  <div class="work-body">
    <div class="work-heading">
      <h2 class="title">${escape(work.title)}</h2>
      <button class="details-link contrib" type="button">details <span aria-hidden="true">↓</span></button>
    </div>
    <div class="work-columns">
      ${forms}
      ${sideCol}
    </div>
    ${description}
  </div>
  ${pager}
</main>
<div class="lightbox" role="dialog" aria-modal="true" aria-label="Full resolution artwork" aria-hidden="true">
  <div class="lightbox-backdrop"></div>
  <div class="lightbox-viewport">
    <img class="lightbox-img" alt="${escape(work.title)}" draggable="false">
  </div>
  <button class="lightbox-close" type="button" aria-label="close">&times;</button>
</div>`;
  const preload = `<link rel="preload" as="image" imagesrcset="${srcset(work, "avif")}" imagesizes="100vw" fetchpriority="high" type="image/avif">`;

  return layout({
    title: `${work.title} — ${ARTIST}`,
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
let STAMPED;

async function build() {
  about = loadAbout("about.md");
  ARTIST = about.data.artist || "Andy Barnow";
  WORDMARK = about.data.wordmark || ARTIST;
  // Keep the previous build available until every page is ready.
  rmSync(distTmp, { recursive: true, force: true });
  mkdirSync(distTmp, { recursive: true });
  const hash = (path) => createHash("md5").update(readFileSync(path)).digest("hex").slice(0, 8);
  STAMPED = {
    css: `/style.css?v=${hash("style.css")}`,
    nav: `/nav.js?v=${hash("nav.js")}`,
    theme: `/theme.js?v=${hash("theme.js")}`,
  };
  cpSync("style.css", distTmp + "style.css");
  cpSync("nav.js", distTmp + "nav.js");
  cpSync("theme.js", distTmp + "theme.js");
  cpSync("_headers", distTmp + "_headers");
  cpSync("_redirects", distTmp + "_redirects");
  cpSync("robots.txt", distTmp + "robots.txt");

  const works = loadWorks(SOURCES_DIR, CONTENT_PATH);
  const placeholders = await loadPlaceholders(works);

  writeFileSync(distTmp + "index.html", gridPage(works, placeholders));
  writeFileSync(distTmp + "404.html", notFoundPage());
  mkdirSync(distTmp + "artist/", { recursive: true });
  writeFileSync(distTmp + "artist/index.html", artistPage());

  for (let i = 0; i < works.length; i++) {
    const dir = `${distTmp}works/${urlSlug(works[i].slug)}/`;
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
    distTmp + "sitemap.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>
`,
  );
  rmSync(distOld, { recursive: true, force: true });
  if (existsSync(dist)) renameSync(dist, distOld);
  renameSync(distTmp, dist);
  rmSync(distOld, { recursive: true, force: true });

  console.log(`dist: ${works.length} works, endpoint ${ENDPOINT}`);
}

await build();

if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  let timer;
  let running = false;
  let pending = false;
  async function rebuild() {
    if (running) { pending = true; return; }
    running = true;
    try { await build(); }
    catch (error) { console.error("Build failed:", error); }
    finally {
      running = false;
      if (pending) { pending = false; schedule(); }
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 100);
  }
  const inputs = new Set([CONTENT_PATH, "about.md", "style.css", "nav.js", "theme.js", "_headers", "_redirects", "robots.txt"]);
  watch(".", (_, filename) => { if (inputs.has(filename)) schedule(); });
  watch(SOURCES_DIR, schedule);
  console.log(`watching content, assets and ${SOURCES_DIR}...`);
}
