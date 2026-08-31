// Same-origin image proxy + edge cache for imgproxy. Not a separate
// third-party domain (that was a Cloudflare Worker on *.workers.dev before
// this) — Safari's tracking/fingerprinting protection treats a shared,
// multi-tenant CDN domain as suspicious and throws up a "reduce
// protections?" prompt. A same-origin path has no cross-domain signal for
// any browser or extension to react to, and it lets the CSP tighten to
// img-src 'self' instead of naming an external host.
async function proxy(context) {
  const url = new URL(context.request.url);
  const target = new URL("https://imgproxy.progapanda.org" + url.pathname.replace(/^\/i/, "") + url.search);
  return fetch(target, { cf: { cacheEverything: true, cacheTtl: 31536000 } });
}

export const onRequestGet = proxy;
export const onRequestHead = proxy;
