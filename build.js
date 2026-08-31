// The build: content/*.md -> dist/. Every imgproxy URL is signed here, once,
// so the salt never has to leave this machine — the deployed HTML only ever
// holds finished, signed URLs. Same idea as tja-web's stamp.js: write the
// pages, content-hash the assets, done.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { loadWorks, loadAbout } from "./content.js";
import { imgproxyUrl, BREAKPOINTS, FORMATS } from "./imgproxy.js";

const SITE = process.env.SITE || "https://art.progapanda.org";
// No default: local dev must build against the local imgproxy container and
// production must build against the production one, and getting that mixed
// up silently would mean shipping localhost URLs or previewing 404s. The
// Makefile sets this explicitly for every target — see dev/dist/deploy.
const ENDPOINT = process.env.IMGPROXY_ENDPOINT;
const SOURCES_DIR = process.env.SOURCES_DIR || "/Users/progapandist/progapanda_art_sources";
const CONTENT_PATH = "content.md";
const KEY = process.env.IMGPROXY_KEY;
const SALT = process.env.IMGPROXY_SALT;
const about = loadAbout("about.md");
const ARTIST = about.data.artist || "Andy Barnow";
const dist = "dist/";

if (!ENDPOINT) throw new Error("IMGPROXY_ENDPOINT must be set — see Makefile (dev/dist target local, deploy target production).");
if (!KEY || !SALT) {
  throw new Error("IMGPROXY_KEY and IMGPROXY_SALT must be set (see .env) — signing needs both.");
}

const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const img = (work, width, format) =>
  imgproxyUrl({ endpoint: ENDPOINT, key: KEY, salt: SALT, slug: work.slug, width, format });

const srcset = (work, format) => BREAKPOINTS.map((w) => `${img(work, w, format)} ${w}w`).join(", ");

// ---- shared page shell -----------------------------------------------------
// "home" drops the "all works" link (it would just point at itself); every
// other page carries both.
function layout({ title, description, canonical, ogImage, body, active }) {
  const links = [
    `<a class="contrib" href="/artist/">artist</a>`,
    active !== "home" && `<a class="contrib" href="/">all works</a>`,
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
<link rel="canonical" href="${canonical}">
<title>${escape(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escape(ARTIST)}">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
${ogImage ? `<meta property="og:image" content="${ogImage}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${ogImage}">` : ""}
<link rel="icon" href="data:,">
<link rel="stylesheet" href="${STAMPED.css}">
</head>
<body>
<header>
  <h1 class="wordmark"><a href="/">${escape(ARTIST)}</a></h1>
  <nav class="header-nav">${links}</nav>
</header>
${body}
</body>
</html>
`;
}

// ---- the grid / home page ---------------------------------------------------
function gridPage(works) {
  const tiles = works
    .map(
      (w) => `  <a class="tile" href="/works/${encodeURIComponent(w.slug)}/">
    <img src="${img(w, 480, "avif")}" alt="${escape(w.title)}" loading="lazy">
    <span class="tile-info">
      <span class="tile-title">${escape(w.title)}</span>
      <span class="tile-meta">${escape([w.location, w.year].filter(Boolean).join(", "))}</span>
    </span>
  </a>`,
    )
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

function workPage(work, prev, next) {
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

  const description = work.description ? `<p class="description">${escape(work.description)}</p>` : "";

  const formats = `<ul class="chips">${FORMATS.map((f) => `<li><a href="${img(work, 3200, f)}">${f}</a></li>`).join("")}</ul>`;

  const pager = `<nav class="pager">
    ${prev ? `<a rel="prev" href="/works/${encodeURIComponent(prev.slug)}/">&larr; ${escape(prev.title)}</a>` : `<span></span>`}
    ${next ? `<a class="next" rel="next" href="/works/${encodeURIComponent(next.slug)}/">${escape(next.title)} &rarr;</a>` : `<span></span>`}
  </nav>`;

  const body = `<main class="work">
  <div class="frame">
    <picture>
      <source type="image/avif" srcset="${srcset(work, "avif")}" sizes="100vw">
      <source type="image/webp" srcset="${srcset(work, "webp")}" sizes="100vw">
      <img src="${img(work, 1920, "jpg")}" srcset="${srcset(work, "jpg")}" sizes="100vw" alt="${escape(work.title)}" loading="eager" fetchpriority="high">
    </picture>
  </div>
  <div class="work-body">
    <h2 class="title">${escape(work.title)}</h2>
    ${forms}
    <div class="chip-block">
      <span class="labels">formats</span>
      ${formats}
    </div>
    ${medium ? `<div class="chip-block"><span class="labels">medium</span>${medium}</div>` : ""}
    ${description}
  </div>
  ${pager}
</main>
<script type="module" src="${STAMPED.nav}"></script>`;

  return layout({
    title: `${escape(work.title)} — ${ARTIST}`,
    description: work.description || `${work.title}, ${[work.location, work.year].filter(Boolean).join(", ")}.`,
    canonical: `${SITE}/works/${encodeURIComponent(work.slug)}/`,
    ogImage: img(work, 1200, "jpg"),
    body,
    active: "work",
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

function build() {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  // Assets first, content-hashed, so the page templates above can reference
  // the stamped URL (computed before any HTML is generated).
  const hash = (path) => createHash("md5").update(readFileSync(path)).digest("hex").slice(0, 8);
  STAMPED = {
    css: `/style.css?v=${hash("style.css")}`,
    nav: `/nav.js?v=${hash("nav.js")}`,
  };
  cpSync("style.css", dist + "style.css");
  cpSync("nav.js", dist + "nav.js");
  cpSync("_headers", dist + "_headers");
  cpSync("_redirects", dist + "_redirects");
  cpSync("robots.txt", dist + "robots.txt");

  const works = loadWorks(SOURCES_DIR, CONTENT_PATH);

  writeFileSync(dist + "index.html", gridPage(works));
  writeFileSync(dist + "404.html", notFoundPage());
  mkdirSync(dist + "artist/", { recursive: true });
  writeFileSync(dist + "artist/index.html", artistPage());

  for (let i = 0; i < works.length; i++) {
    const dir = `${dist}works/${works[i].slug}/`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(dir + "index.html", workPage(works[i], works[i - 1] || null, works[i + 1] || null));
  }

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${SITE}/`, priority: "1.0" },
    { loc: `${SITE}/artist/`, priority: "0.5" },
    ...works.map((w) => ({ loc: `${SITE}/works/${encodeURIComponent(w.slug)}/`, priority: "0.8" })),
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

build();

if (process.argv.includes("--watch")) {
  const { watch } = await import("node:fs");
  console.log(`watching ${CONTENT_PATH}, style.css, nav.js, ${SOURCES_DIR}...`);
  for (const path of [CONTENT_PATH, "style.css", "nav.js"]) {
    watch(path, () => build());
  }
  // Not recursive: a new or deleted file directly in the sources folder is
  // what changes the work list; edits inside it don't matter here.
  watch(SOURCES_DIR, () => build());
}
