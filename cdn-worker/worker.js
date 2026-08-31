// Caching reverse proxy for imgproxy.progapanda.org. The droplet's origin
// isn't behind Cloudflare's edge at all (progapanda.org's DNS lives on
// DigitalOcean, not Cloudflare) — this puts Cloudflare's CDN cache in front
// of it anyway, without needing to move the zone. cacheEverything ignores
// origin cache-control (imgproxy already sends a 1-year one, but this makes
// it explicit and works even if that ever changes); the path — including
// the imgproxy signature — passes through untouched, so signing still
// happens at the origin exactly as before.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = "https:";
    url.hostname = "imgproxy.progapanda.org";
    return fetch(new Request(url, request), { cf: { cacheEverything: true, cacheTtl: 31536000 } });
  },
};
