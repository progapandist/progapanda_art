// Signs imgproxy URLs at build time so the salt never reaches the browser —
// only finished, signed URLs ship in the static HTML. Same signing scheme
// (HMAC-SHA256 of salt‖path, base64url) the Rails Imgproxy gem used.
import { createHmac } from "node:crypto";

export const BREAKPOINTS = [480, 768, 1024, 1440, 1920, 2560, 3200];
export const FORMATS = ["avif", "webp", "jpg", "png"];

function sign(path, key, salt) {
  const hmac = createHmac("sha256", Buffer.from(key, "hex"));
  hmac.update(Buffer.from(salt, "hex"));
  hmac.update(path);
  return hmac.digest("base64url");
}

// resizing_type "fit" everywhere: never crops, never enlarges past the
// source's native resolution, so a breakpoint list oversized for a small
// scan just returns the original — no per-image conditional needed.
//
// `version`, when given, is appended as a `?v=` query param — outside the
// signed path, so it doesn't touch the signature, but still part of the
// URL the browser (and Cloudflare's edge cache in front of imgproxy, see
// functions/i/[[path]].js) requests. It's meant to be a work's content
// hash: editing a source image in place keeps its filename, so without
// this its imgproxy URL would stay byte-for-byte identical after the
// edit, and the CDN — which has no way to know the origin bytes changed —
// would keep serving the pre-edit version for up to a year. A changed
// hash gives every edit a URL the edge has never seen, so it's always a
// fresh fetch; the stale cache entry is simply never requested again.
export function imgproxyUrl({ endpoint, key, salt, slug, width, format = "avif", blur, quality, version }) {
  const source = encodeURIComponent(slug);
  const opts = [`rs:fit:${width}:0`, blur && `bl:${blur}`, quality && `q:${quality}`].filter(Boolean).join("/");
  const path = `/${opts}/plain/${source}@${format}`;
  const query = version ? `?v=${encodeURIComponent(version)}` : "";
  return `${endpoint}/${sign(path, key, salt)}${path}${query}`;
}

// A tiny, low-quality fetch — small enough to embed as a base64 data URI
// directly in the page, so something paints in the frame before the real
// (often multi-megabyte source, AVIF-encoded-on-first-request) image
// arrives. `bl:` is a sigma in source pixels, not a fraction of the output
// — at width 40 a blur of 10 was ~25% of the whole image, which smeared
// every work into a near-uniform color field instead of a recognizable
// rough shape. A little more resolution and much less blur lets real
// edges survive; the browser's own upscaling to fill the frame softens it
// further, so this doesn't need to do all the softening itself. (Saturation
// boosting would help further, but imgproxy's `sa:` option is Pro-only —
// not available on the open-source build this runs; style.css's
// .placeholder filter does that instead.)
export async function placeholder({ endpoint, key, salt, slug }) {
  const url = imgproxyUrl({ endpoint, key, salt, slug, width: 64, format: "jpg", blur: 3, quality: 45 });
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
