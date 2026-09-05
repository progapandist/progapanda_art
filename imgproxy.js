// Sign at build time; only finished URLs reach the browser.
import { createHmac } from "node:crypto";

export const BREAKPOINTS = [480, 768, 1024, 1440, 1920, 2560, 3200];
export const FORMATS = ["avif", "webp", "jpg", "png"];

function sign(path, key, salt) {
  const hmac = createHmac("sha256", Buffer.from(key, "hex"));
  hmac.update(Buffer.from(salt, "hex"));
  hmac.update(path);
  return hmac.digest("base64url");
}
export function imgproxyUrl({ endpoint, key, salt, slug, width, format = "avif", blur, quality, version }) {
  const source = encodeURIComponent(slug);
  const opts = [`rs:fit:${width}:0`, blur && `bl:${blur}`, quality && `q:${quality}`].filter(Boolean).join("/");
  const path = `/${opts}/plain/${source}@${format}`;
  const query = version ? `?v=${encodeURIComponent(version)}` : "";
  return `${endpoint}/${sign(path, key, salt)}${path}${query}`;
}
export async function placeholder({ endpoint, key, salt, slug }) {
  const url = imgproxyUrl({ endpoint, key, salt, slug, width: 64, format: "jpg", blur: 3, quality: 45 });
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
