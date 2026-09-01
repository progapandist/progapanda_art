// content.md is the single file for every work's copy — one "## slug" section
// per source image. The build reconciles it against the sources folder: a
// new file gets a stub section appended, a deleted file's section is
// dropped. Editing content.md by hand is the only authoring step; nothing
// else needs to be kept in sync by hand.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function coerce(value) {
  if (value === "") return "";
  return Number.isNaN(Number(value)) ? value : Number(value);
}

export const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// The only markdown a description body ever needs: paragraphs (separated
// by a blank line) and a "- " bulleted list. A block renders as a <ul>
// only if every one of its lines starts with "- "; anything else is a
// plain paragraph with single newlines kept as <br> (a soft line break
// inside one paragraph, not a new one).
export const renderDescription = (text) =>
  text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length && lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${escape(l.slice(2))}</li>`).join("")}</ul>`;
      }
      return `<p>${escape(block.trim()).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

// Frontmatter reader for a single "---" block — used for about.md, which is
// site-wide copy, not a per-work section.
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text.trim() };
  const [, front, body] = m;
  const data = {};
  for (const line of front.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    data[line.slice(0, i).trim()] = coerceValue(line.slice(i + 1).trim());
  }
  return { data, body: body.trim() };
}

function coerceValue(raw) {
  return raw.startsWith("[") && raw.endsWith("]")
    ? raw
        .slice(1, -1)
        .split(",")
        .map((v) => coerce(v.trim()))
        .filter((v) => v !== "")
    : coerce(raw);
}

export function loadAbout(path) {
  return parseFrontmatter(readFileSync(path, "utf8"));
}

// Some source files carry a real image extension (newer additions do, the
// original batch doesn't) — strip it for anything user-facing: a title, or
// the public /works/<slug>/ URL. The real filename (with extension, if any)
// stays the lookup key for the actual imgproxy source, in imgproxy.js.
export function urlSlug(slug) {
  return slug.replace(/\.(jpe?g|png|webp|avif|tiff?|heic)$/i, "");
}

export function humanize(slug) {
  const s = urlSlug(slug).replace(/_id$/, "").replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ---- content.md: "## slug" sections ----------------------------------------

// A section is key:value lines, a blank line, then a free-text body — the
// same shape as frontmatter, just introduced by a heading instead of a file.
export function parseContentFile(text) {
  const sections = new Map();
  let slug = null,
    data = {},
    bodyLines = [],
    inBody = false;

  const flush = () => {
    if (slug !== null) sections.set(slug, { data, body: bodyLines.join("\n").trim() });
  };

  for (const line of text.split("\n")) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      flush();
      slug = heading[1].trim();
      data = {};
      bodyLines = [];
      inBody = false;
      continue;
    }
    if (slug === null) continue; // ignore anything before the first heading
    if (!inBody) {
      if (line.trim() === "") {
        inBody = true;
        continue;
      }
      const i = line.indexOf(":");
      if (i === -1) {
        inBody = true;
        bodyLines.push(line);
        continue;
      }
      data[line.slice(0, i).trim()] = coerceValue(line.slice(i + 1).trim());
      continue;
    }
    bodyLines.push(line);
  }
  flush();
  return sections;
}

export function serializeContentFile(sections, order) {
  return (
    order
      .map((slug) => {
        const { data, body } = sections.get(slug);
        const lines = [`## ${slug}`];
        for (const [k, v] of Object.entries(data)) {
          lines.push(`${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`);
        }
        if (body) lines.push("", body);
        return lines.join("\n");
      })
      .join("\n\n") + "\n"
  );
}

// The list of works is whatever is actually in the sources folder — adding
// or removing a file there is the whole editing step, `make dist` picks it
// up. Alphabetical here on purpose, even though the site itself displays a
// shuffled order (see shuffledBySeed below) — this order is what
// content.md gets written in, and alphabetical is what makes it easy for a
// human to find a given work in that file by hand.
export function scanSources(dir) {
  return readdirSync(dir)
    .filter((f) => !f.startsWith(".") && statSync(join(dir, f)).isFile())
    .sort();
}

// A per-file fingerprint, stored as each section's `hash:` field, used only
// to recognize a renamed file (same bytes, new name) so its section can be
// retitled instead of stubbed-and-deleted. "h" prefix keeps an
// all-digits hash from being coerced into a JS number by coerceValue.
function fileHash(path) {
  return "h" + Bun.hash(readFileSync(path)).toString(16);
}

// A fixed, deliberately-chosen seed — not "the current date" or anything
// that would silently reshuffle the site on its own. Change this constant
// only when an actual reshuffle is wanted; the same seed always produces
// the same order. Sorting by hash(seed + slug) rather than doing a
// Fisher-Yates pass over the array means adding or removing one work only
// slots that one work in or out — it doesn't perturb every other work's
// relative position the way a length-dependent shuffle algorithm would.
const SHUFFLE_SEED = "progapanda-84";

function seededHash(str) {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffledBySeed(slugs) {
  return [...slugs].sort((a, b) => seededHash(SHUFFLE_SEED + a) - seededHash(SHUFFLE_SEED + b));
}

function toWork(slug, section) {
  const data = section?.data || {};
  return {
    slug,
    title: data.title || humanize(slug),
    year: data.year || null,
    location: data.location || "",
    medium: data.medium || [],
    dimensions: data.dimensions || [],
    availability: data.availability || "",
    price: data.price || null,
    description: section?.body || "",
    // The stored content hash also doubles as an edge-cache-busting
    // version tag on every imgproxy URL for this work (see build.js/
    // imgproxy.js) — editing a source image in place keeps its filename,
    // so without this its imgproxy URL would stay identical and the CDN
    // would keep serving pre-edit bytes for up to a year.
    hash: data.hash || null,
  };
}

// Reconciles content.md against the sources folder: appends a stub section
// for a source file that has none yet, retitles a section in place when its
// file was only renamed (same bytes, matched by hash — see fileHash), and
// for a section whose file is genuinely gone, leaves it in content.md with
// a `warning:` field rather than deleting it — the description survives
// for a human to either restore the file or delete the section themselves.
// A `warning:`ed section is simply never in `files`, so it's automatically
// excluded from the returned works (the image is gone from the build even
// though its text sticks around). Rewrites content.md when anything
// changed, and returns the merged works in the site's display order
// (seeded-shuffled, not alphabetical).
export function loadWorks(sourcesDir, contentPath) {
  const files = scanSources(sourcesDir);
  const sections = parseContentFile(readFileSync(contentPath, "utf8"));

  const added = files.filter((f) => !sections.has(f));
  // Sections already flagged missing stay out of rename-matching too — once
  // a human has seen the warning, don't touch that section again on their
  // behalf; they restore the file (same name) or delete the section.
  const gone = [...sections.keys()].filter((s) => !files.includes(s) && !sections.get(s).data.warning);

  const renames = new Map(); // oldSlug -> newSlug
  if (added.length && gone.length) {
    const addedHashes = new Map(added.map((f) => [fileHash(join(sourcesDir, f)), f]));
    for (const oldSlug of gone) {
      const match = addedHashes.get(sections.get(oldSlug).data.hash);
      if (match) renames.set(oldSlug, match);
    }
  }
  for (const [oldSlug, newSlug] of renames) {
    const section = sections.get(oldSlug);
    sections.delete(oldSlug);
    sections.set(newSlug, section);
  }

  const stillGone = gone.filter((s) => !renames.has(s));
  const freshlyAdded = added.filter((f) => ![...renames.values()].includes(f));
  for (const slug of freshlyAdded) {
    sections.set(slug, { data: { location: "Berlin", year: new Date().getFullYear() }, body: "" });
  }

  // Recompute every current file's hash on every build (cheap: a fraction
  // of a second even for hundreds of MB) rather than only backfilling a
  // missing one — otherwise an edited-but-not-renamed file would keep
  // fingerprinting its old bytes forever, and a *later* rename of that same
  // file would miss the match. Also clears a stale warning if a file
  // reappears under the exact name it was flagged under.
  let rehashed = 0;
  for (const f of files) {
    const data = sections.get(f).data;
    const hash = fileHash(join(sourcesDir, f));
    if (data.hash !== hash) {
      data.hash = hash;
      rehashed++;
    }
    if (data.warning) delete data.warning;
  }

  for (const slug of stillGone) {
    sections.get(slug).data.warning =
      `source file missing — excluded from the site. Restore a file named "${slug}", or delete this section.`;
  }

  const order = [...files, ...stillGone.sort()];
  if (freshlyAdded.length || renames.size || stillGone.length || rehashed) {
    writeFileSync(contentPath, serializeContentFile(sections, order));
    const bits = [];
    if (freshlyAdded.length) bits.push(`+${freshlyAdded.length} added (${freshlyAdded.join(", ")})`);
    if (renames.size) bits.push(`${renames.size} renamed (${[...renames].map(([a, b]) => `${a} -> ${b}`).join(", ")})`);
    if (stillGone.length) bits.push(`${stillGone.length} missing, kept as warnings (${stillGone.join(", ")})`);
    if (rehashed) bits.push(`${rehashed} hash${rehashed === 1 ? "" : "es"} updated`);
    console.log(`content.md: ${bits.join("; ")}`);
  }

  // content.md is written in the alphabetical `files` order (easy to find a
  // work by hand), with any missing-file warnings appended after; the site
  // itself displays the seeded-shuffled order instead — grid order and
  // prev/next both follow that.
  return shuffledBySeed(files).map((f) => toWork(f, sections.get(f)));
}
