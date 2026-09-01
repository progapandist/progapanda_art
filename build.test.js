import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFrontmatter, parseContentFile, serializeContentFile, loadWorks, humanize, shuffledBySeed, renderDescription } from "./content.js";
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
    // content.md lives outside the sources folder, same as in the real repo
    // (it's at the root, sources are an external folder) — otherwise scanning
    // the folder would pick up content.md itself as a "work".
    const sourcesDir = mkdtempSync(join(tmpdir(), "progapanda-art-sources-"));
    const rootDir = mkdtempSync(join(tmpdir(), "progapanda-art-root-"));
    try {
      writeFileSync(join(sourcesDir, "bloom"), "bloom-bytes");
      writeFileSync(join(sourcesDir, "crow"), "crow-bytes");
      const contentPath = join(rootDir, "content.md");
      writeFileSync(contentPath, "## bloom\nyear: 2023\n\nAlready described.\n\n## gone\nyear: 2020\n\nLost description.\n");

      const works = loadWorks(sourcesDir, contentPath);

      // Display order is seeded-shuffled, not file order — check membership,
      // not position. "gone" has no matching file (and no hash to match a
      // rename against), so it's excluded from the built works...
      expect(works.map((w) => w.slug).sort()).toEqual(["bloom", "crow"]);
      const bloom = works.find((w) => w.slug === "bloom");
      const crow = works.find((w) => w.slug === "crow");
      expect(bloom.description).toBe("Already described.");
      expect(crow.title).toBe("Crow"); // stub section, title falls back to humanize

      // content.md itself is still written in plain alphabetical file order,
      // with "gone" kept at the end — flagged, not deleted, so the
      // description survives for a human to act on.
      const rewritten = readFileSync(contentPath, "utf8");
      expect(rewritten.indexOf("## bloom")).toBeLessThan(rewritten.indexOf("## crow"));
      expect(rewritten).toContain("## gone");
      expect(rewritten).toContain("warning: source file missing");
      expect(rewritten).toContain("Lost description.");
      // Every section for a file that does exist gets a hash backfilled.
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
      // First pass just to get a hash recorded under the old name, exactly
      // like a real content.md would already have from a prior build.
      writeFileSync(join(sourcesDir, "old_name"), "identical-bytes");
      writeFileSync(contentPath, "");
      loadWorks(sourcesDir, contentPath); // writes a stub for old_name with a hash

      // Simulate `mv old_name new_name`: same bytes, new filename.
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

      // Edit in place — same filename, different bytes (e.g. a re-export).
      writeFileSync(join(sourcesDir, "photo"), "edited-bytes");
      loadWorks(sourcesDir, contentPath); // must refresh the stored hash

      // Now rename the edited file. If the hash above went stale, this
      // would be missed and wrongly treated as delete+add.
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
  test("renders a block of \"- \" lines as a list, and everything else as paragraphs", () => {
    const html = renderDescription("Intro line.\n\n- first\n- second\n\nClosing <b>paragraph</b> & more.");
    expect(html).toBe(
      "<p>Intro line.</p>" + "<ul><li>first</li><li>second</li></ul>" + "<p>Closing &lt;b&gt;paragraph&lt;/b&gt; &amp; more.</p>",
    );
  });

  test("a block only counts as a list if every line starts with \"- \"", () => {
    const html = renderDescription("- first\nsecond line, no dash");
    expect(html).toBe("<p>- first<br>second line, no dash</p>");
  });
});

describe("imgproxyUrl", () => {
  // Independently computed with node:crypto directly (HMAC-SHA256 of
  // salt‖path, base64url) — a regression check on imgproxy.js's path
  // construction and byte order, not just a snapshot of its own output.
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
