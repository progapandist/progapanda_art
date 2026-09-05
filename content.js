import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function coerce(value) {
  if (value === "") return "";
  return Number.isNaN(Number(value)) ? value : Number(value);
}

export const escape = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Markdown is compiled to HTML by Bun; no renderer ships to the browser.
export const renderDescription = (text) => Bun.markdown.html(text, {
  autolinks: true,
  noHtmlBlocks: true,
  noHtmlSpans: true,
});

export function parseFrontmatter(text) {
  text = text.replace(/\r\n/g, "\n");
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text.trim() };
  const [, front, body] = m;
  const data = {};
  for (const line of front.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i < 1) continue;
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
export function urlSlug(slug) {
  return slug.replace(/\.(jpe?g|png|webp|avif|tiff?|heic)$/i, "");
}

export function humanize(slug) {
  const s = urlSlug(slug).replace(/_id$/, "").replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
export function parseContentFile(text) {
  const sections = new Map();
  let slug = null,
    data = {},
    bodyLines = [],
    inBody = false;

  const flush = () => {
    if (slug !== null) sections.set(slug, { data, body: bodyLines.join("\n").trim() });
  };

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let fence = null;
  const metadata = /^(title|year|location|medium|dimensions|availability|price|hash|warning):/;
  for (const [index, line] of lines.entries()) {
    if (fence) {
      bodyLines.push(line);
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (closing && closing[1][0] === fence[0] && closing[1].length >= fence.length) fence = null;
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (slug !== null && opening) {
      fence = opening[1];
      inBody = true;
      bodyLines.push(line);
      continue;
    }
    const heading = line.match(/^## (.+)$/);
    // A work heading is followed immediately by metadata; other headings belong to its body.
    if (heading && (slug === null || metadata.test(lines[index + 1] || ""))) {
      flush();
      slug = heading[1].trim();
      if (sections.has(slug)) throw new Error(`Duplicate content section: ${slug}`);
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
export function scanSources(dir) {
  return readdirSync(dir)
    .filter((f) => !f.startsWith(".") && statSync(join(dir, f)).isFile())
    .sort();
}
function fileHash(path) {
  return "h" + Bun.hash(readFileSync(path)).toString(16);
}
const SHUFFLE_SEED = "dolboeb";

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
export function dimensionsText(dimensions) {
  if (Array.isArray(dimensions)) {
    if (!dimensions.length) return null;
    return dimensions.filter((n) => n !== null && n !== undefined).join(" × ") + " cm";
  }
  return dimensions ? String(dimensions) : null;
}

function toWork(slug, section) {
  const data = section?.data || {};
  return {
    slug,
    title: data.title || humanize(slug),
    year: data.year || null,
    location: data.location || "",
    medium: Array.isArray(data.medium) ? data.medium : data.medium ? [data.medium] : [],
    dimensions: data.dimensions || [],
    availability: data.availability || "",
    price: data.price || null,
    description: section?.body || "",
    hash: data.hash || null,
  };
}
export function loadWorks(sourcesDir, contentPath) {
  const files = scanSources(sourcesDir);
  const sections = parseContentFile(readFileSync(contentPath, "utf8"));

  const hashes = new Map(files.map((file) => [file, fileHash(join(sourcesDir, file))]));
  const routes = new Set();
  for (const file of files) {
    const route = urlSlug(file);
    if (!route || route === "." || route === ".." || routes.has(route)) {
      throw new Error(`Invalid or duplicate work URL: ${file}`);
    }
    routes.add(route);
  }

  // Match only unambiguous renames; duplicate images must not overwrite copy.
  const added = files.filter((file) => !sections.has(file));
  const missing = [...sections.keys()].filter((file) => !hashes.has(file));
  for (const file of added) {
    const hash = hashes.get(file);
    const matches = missing.filter((old) => !sections.get(old)?.data.warning && sections.get(old)?.data.hash === hash);
    const uniqueSource = added.filter((other) => hashes.get(other) === hash).length === 1;
    if (matches.length === 1 && uniqueSource) {
      sections.set(file, sections.get(matches[0]));
      sections.delete(matches[0]);
    } else {
      sections.set(file, { data: { location: "Berlin", year: new Date().getFullYear() }, body: "" });
    }
  }
  for (const file of files) {
    const data = sections.get(file).data;
    data.hash = hashes.get(file);
    delete data.warning;
  }
  const stillMissing = [...sections.keys()].filter((file) => !hashes.has(file)).sort();
  for (const file of stillMissing) {
    sections.get(file).data.warning =
      `source file missing — excluded from the site. Restore a file named "${file}", or delete this section.`;
  }
  const content = serializeContentFile(sections, [...files, ...stillMissing]);
  if (content !== readFileSync(contentPath, "utf8")) writeFileSync(contentPath, content);

  return shuffledBySeed(files).map((f) => toWork(f, sections.get(f)));
}
