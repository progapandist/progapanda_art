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
export function imgproxyUrl({ endpoint, key, salt, slug, width, format = "avif" }) {
  const source = encodeURIComponent(slug);
  const path = `/rs:fit:${width}:0/plain/${source}@${format}`;
  return `${endpoint}/${sign(path, key, salt)}${path}`;
}
