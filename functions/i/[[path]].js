async function proxy(context) {
  const url = new URL(context.request.url);
  const target = new URL("https://imgproxy.progapanda.org" + url.pathname.replace(/^\/i/, "") + url.search);
  return fetch(target, { method: context.request.method, cf: { cacheEverything: true, cacheTtl: 31536000 } });
}

export const onRequestGet = proxy;
export const onRequestHead = proxy;
