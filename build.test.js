import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter, parseContentFile, serializeContentFile, loadWorks, humanize, shuffledBySeed, renderDescription, dimensionsText } from "./content.js";
import { imgproxyUrl } from "./imgproxy.js";

describe("parseFrontmatter", () => {
  test("reads scalars and arrays, leaves the body", () => {
    const text = `---
title: Bloom
year: 2023
medium: [print, Dibond]
dimensions: [90, 60, 0.5]
---

A description that spans
two lines.`;
    const { data, body } = parseFrontmatter(text);
    expect(data.title).toBe("Bloom");
    expect(data.year).toBe(2023);
    expect(data.medium).toEqual(["print", "Dibond"]);
    expect(data.dimensions).toEqual([90, 60, 0.5]);
    expect(body).toBe("A description that spans\ntwo lines.");
  });

  test("a file with no body still parses", () => {
    const { data, body } = parseFrontmatter("---\nyear: 2024\n---\n");
    expect(data.year).toBe(2024);
    expect(body).toBe("");
  });
});

describe("humanize", () => {
  test("matches the old Rails slug.humanize title", () => {
    expect(humanize("all_eyes_freestyle_render")).toBe("All eyes freestyle render");
    expect(humanize("red squares")).toBe("Red squares");
    expect(humanize("flat2")).toBe("Flat2");
  });

  test("strips a real image extension before humanizing", () => {
    expect(humanize("ix.jpg")).toBe("Ix");
    expect(humanize("rage masquerading as cheer.jpeg")).toBe("Rage masquerading as cheer");
  });
});

describe("shuffledBySeed", () => {
  const slugs = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"];

  test("is deterministic — same input, same order, every call", () => {
    expect(shuffledBySeed(slugs)).toEqual(shuffledBySeed(slugs));
  });

  test("is not just the input order (sanity check it actually shuffles)", () => {
    expect(shuffledBySeed(slugs)).not.toEqual(slugs);
  });

  test("contains exactly the same slugs, just reordered", () => {
    expect([...shuffledBySeed(slugs)].sort()).toEqual([...slugs].sort());
  });

  test("adding one slug doesn't reorder the others relative to each other", () => {
    const withOneMore = shuffledBySeed([...slugs, "golf"]).filter((s) => s !== "golf");
    expect(withOneMore).toEqual(shuffledBySeed(slugs));
  });
});

describe("parseContentFile / serializeContentFile", () => {
  const text = `## bloom
year: 2023
medium: [print, Dibond]

A description.

## crow
year: 2024
`;

  test("reads sections, tolerates one with no body", () => {
    const sections = parseContentFile(text);
    expect(sections.get("bloom").data).toEqual({ year: 2023, medium: ["print", "Dibond"] });
    expect(sections.get("bloom").body).toBe("A description.");
    expect(sections.get("crow").data).toEqual({ year: 2024 });
    expect(sections.get("crow").body).toBe("");
  });

  test("round-trips through serialize", () => {
    const sections = parseContentFile(text);
    const again = parseContentFile(serializeContentFile(sections, ["bloom", "crow"]));
    expect(again.get("bloom")).toEqual(sections.get("bloom"));
    expect(again.get("crow")).toEqual(sections.get("crow"));
  });
});

describe("loadWorks", () => {
  test("adds a stub section for a new source file and keeps a missing one as a warning, not a deletion", () => {
    const sourcesDir = mkdtempSync(join(tmpdir(), "progapanda-art-sources-"));
    const rootDir = mkdtempSync(join(tmpdir(), "progapanda-art-root-"));
    try {
      writeFileSync(join(sourcesDir, "bloom"), "bloom-bytes");
      writeFileSync(join(sourcesDir, "crow"), "crow-bytes");
      const contentPath = join(rootDir, "content.md");
      writeFileSync(contentPath, "## bloom\nyear: 2023\n\nAlready described.\n\n## gone\nyear: 2020\n\nLost description.\n");

      const works = loadWorks(sourcesDir, contentPath);
      expect(works.map((w) => w.slug).sort()).toEqual(["bloom", "crow"]);
      const bloom = works.find((w) => w.slug === "bloom");
      const crow = works.find((w) => w.slug === "crow");
      expect(bloom.description).toBe("Already described.");
      expect(crow.title).toBe("Crow"); // stub section, title falls back to humanize
      const rewritten = readFileSync(contentPath, "utf8");
      expect(rewritten.indexOf("## bloom")).toBeLessThan(rewritten.indexOf("## crow"));
      expect(rewritten).toContain("## gone");
      expect(rewritten).toContain("warning: source file missing");
      expect(rewritten).toContain("Lost description.");
      expect(parseContentFile(rewritten).get("bloom").data.hash).toMatch(/^h[0-9a-f]+$/);
    } finally {
      rmSync(sourcesDir, { recursive: true, force: true });
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("retitles a section in place when its file is renamed (matched by content hash)", () => {
    const sourcesDir = mkdtempSync(join(tmpdir(), "progapanda-art-sources-"));
    const rootDir = mkdtempSync(join(tmpdir(), "progapanda-art-root-"));
    try {
      const contentPath = join(rootDir, "content.md");
      writeFileSync(join(sourcesDir, "old_name"), "identical-bytes");
      writeFileSync(contentPath, "");
      loadWorks(sourcesDir, contentPath); // writes a stub for old_name with a hash
      rmSync(join(sourcesDir, "old_name"));
      writeFileSync(join(sourcesDir, "new_name"), "identical-bytes");

      const works = loadWorks(sourcesDir, contentPath);

      expect(works.map((w) => w.slug)).toEqual(["new_name"]);
      const rewritten = readFileSync(contentPath, "utf8");
      expect(rewritten).toContain("## new_name");
      expect(rewritten).not.toContain("## old_name");
      expect(rewritten).not.toContain("warning:");
    } finally {
      rmSync(sourcesDir, { recursive: true, force: true });
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("re-hashes an edited file so a later rename of it still matches", () => {
    const sourcesDir = mkdtempSync(join(tmpdir(), "progapanda-art-sources-"));
    const rootDir = mkdtempSync(join(tmpdir(), "progapanda-art-root-"));
    try {
      const contentPath = join(rootDir, "content.md");
      writeFileSync(join(sourcesDir, "photo"), "original-bytes");
      writeFileSync(contentPath, "");
      loadWorks(sourcesDir, contentPath); // records a hash of "original-bytes"
      writeFileSync(join(sourcesDir, "photo"), "edited-bytes");
      loadWorks(sourcesDir, contentPath); // must refresh the stored hash
      rmSync(join(sourcesDir, "photo"));
      writeFileSync(join(sourcesDir, "photo_renamed"), "edited-bytes");
      const works = loadWorks(sourcesDir, contentPath);

      expect(works.map((w) => w.slug)).toEqual(["photo_renamed"]);
      const rewritten = readFileSync(contentPath, "utf8");
      expect(rewritten).not.toContain("warning:");
    } finally {
      rmSync(sourcesDir, { recursive: true, force: true });
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("renderDescription", () => {
  test("renders paragraphs, emphasis, links and bare email addresses", () => {
    const html = renderDescription("Based in **Berlin**.\n\nContact andrey@hey.com or [website](https://example.com).");
    expect(html).toContain("<p>Based in <strong>Berlin</strong>.</p>");
    expect(html).toContain('href="mailto:andrey@hey.com"');
    expect(html).toContain('href="https://example.com"');
  });

  test("supports headings, nested lists, quotes, tables and fenced code", () => {
    const html = renderDescription("### Process\n\n1. First\n   - nested\n\n> Quote\n\n| A | B |\n|---|---|\n| x | y |\n\n```js\nconst x = 1;\n```");
    for (const tag of ["<h3>", "<ol>", "<ul>", "<blockquote>", "<table>", "<pre>"]) expect(html).toContain(tag);
    expect(html).toContain("const x = 1;");
  });

  test("escapes raw HTML and renders empty content as empty", () => {
    expect(renderDescription("<script>alert(1)</script>")).not.toContain("<script>");
    expect(renderDescription("<b>text</b>")).toContain("&lt;b&gt;");
    expect(renderDescription("")).toBe("");
  });

  test("keeps body headings and fenced section-like text when round-tripping", () => {
    const text = "## work\nyear: 2024\n\n## Process\n\nA paragraph.\n\n```md\n## fake\nyear: 1999\n```\n\n## next\nyear: 2025\n";
    const sections = parseContentFile(text);
    expect([...sections.keys()]).toEqual(["work", "next"]);
    expect(sections.get("work").body).toContain("## Process");
    expect(sections.get("work").body).toContain("## fake");
    expect(parseContentFile(serializeContentFile(sections, [...sections.keys()]))).toEqual(sections);
  });
});

describe("dimensionsText", () => {
  test("joins a numeric array with a cm unit", () => {
    expect(dimensionsText([90, 60, 0.5])).toBe("90 × 60 × 0.5 cm");
  });

  test("passes free text through unchanged, no unit appended", () => {
    expect(dimensionsText("scalable on request")).toBe("scalable on request");
  });

  test("null for an empty array or no value", () => {
    expect(dimensionsText([])).toBeNull();
    expect(dimensionsText(undefined)).toBeNull();
  });
});

describe("imgproxyUrl", () => {
  test("signs the exact path imgproxy expects", () => {
    const url = imgproxyUrl({
      endpoint: "http://localhost:8080",
      key: "abcd1234",
      salt: "1234abcd",
      slug: "testslug",
      width: 800,
      format: "avif",
    });
    expect(url).toBe(
      "http://localhost:8080/FXpD8mRz-EFijNis7AcYTF_bmePJXOdv5s5Vl0x64Z0/rs:fit:800:0/plain/testslug@avif",
    );
  });

  test("appends a version as a query param, outside the signed path", () => {
    const withVersion = imgproxyUrl({
      endpoint: "http://localhost:8080",
      key: "abcd1234",
      salt: "1234abcd",
      slug: "testslug",
      width: 800,
      format: "avif",
      version: "h123abc",
    });
    const withoutVersion = imgproxyUrl({
      endpoint: "http://localhost:8080",
      key: "abcd1234",
      salt: "1234abcd",
      slug: "testslug",
      width: 800,
      format: "avif",
    });
    expect(withVersion).toBe(withoutVersion + "?v=h123abc");
  });

  test("URL-encodes a slug with a space", () => {
    const url = imgproxyUrl({
      endpoint: "http://localhost:8080",
      key: "abcd1234",
      salt: "1234abcd",
      slug: "red squares",
      width: 480,
      format: "jpg",
    });
    expect(url).toContain("/plain/red%20squares@jpg");
  });
});

describe("content reconciliation regressions", () => {
  function fixture(run) {
    const root = mkdtempSync(join(tmpdir(), "art-regression-"));
    const sources = join(root, "sources");
    require("node:fs").mkdirSync(sources);
    const content = join(root, "content.md");
    writeFileSync(content, "");
    try { run(sources, content); }
    finally { rmSync(root, { recursive: true, force: true }); }
  }

  test("keeps previously missing copy when another source changes", () => fixture((sources, content) => {
    writeFileSync(content, "## absent\nyear: 2020\n\nKeep this copy.\n");
    loadWorks(sources, content);
    writeFileSync(join(sources, "new"), "new image");
    loadWorks(sources, content);
    expect(readFileSync(content, "utf8")).toContain("Keep this copy.");
    expect(parseContentFile(readFileSync(content, "utf8")).get("absent").data.warning).toBeTruthy();
  }));

  test("clears a missing warning when identical source bytes return", () => fixture((sources, content) => {
    writeFileSync(join(sources, "work"), "image");
    loadWorks(sources, content);
    rmSync(join(sources, "work"));
    loadWorks(sources, content);
    writeFileSync(join(sources, "work"), "image");
    loadWorks(sources, content);
    expect(readFileSync(content, "utf8")).not.toContain("warning:");
  }));

  test("preserves both descriptions when a rename is ambiguous", () => fixture((sources, content) => {
    for (const name of ["one", "two"]) writeFileSync(join(sources, name), "same");
    writeFileSync(content, "## one\nyear: 2020\n\nFirst copy.\n\n## two\nyear: 2021\n\nSecond copy.\n");
    loadWorks(sources, content);
    for (const name of ["one", "two"]) rmSync(join(sources, name));
    writeFileSync(join(sources, "renamed"), "same");
    loadWorks(sources, content);
    expect(readFileSync(content, "utf8")).toContain("First copy.");
    expect(readFileSync(content, "utf8")).toContain("Second copy.");
  }));

  test("rejects colliding public URLs before changing content", () => fixture((sources, content) => {
    writeFileSync(join(sources, "work.jpg"), "one");
    writeFileSync(join(sources, "work.png"), "two");
    expect(() => loadWorks(sources, content)).toThrow("duplicate work URL");
    expect(readFileSync(content, "utf8")).toBe("");
  }));

  test("accepts a scalar medium", () => fixture((sources, content) => {
    writeFileSync(join(sources, "work"), "one");
    writeFileSync(content, "## work\nmedium: oil\n");
    expect(loadWorks(sources, content)[0].medium).toEqual(["oil"]);
  }));

  test("parses Windows line endings", () => {
    expect(parseFrontmatter("---\r\nyear: 2024\r\n---\r\nBio").data.year).toBe(2024);
    expect(parseContentFile("## work\r\nyear: 2024\r\n\r\nCopy").get("work").body).toBe("Copy");
  });
});

// The zoomed lightbox has been broken twice by "centring" it with flex alone:
// auto margins only take positive free space, so an overflowing image falls back
// to justify-content and its left/top edge becomes unreachable.
describe("lightbox zoom CSS", () => {
  const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
  const rule = (selector) => css.split(selector)[1].split("}")[0];

  test("zoomed viewport aligns from the start so the image never clips", () => {
    const viewport = rule(".lightbox.zoomed .lightbox-viewport {");
    expect(viewport).toContain("align-items: flex-start");
    expect(viewport).toContain("justify-content: flex-start");
  });

  test("zoomed image centres itself with auto margins", () => {
    expect(rule(".lightbox.zoomed .lightbox-img {")).toContain("margin: auto");
  });
});
