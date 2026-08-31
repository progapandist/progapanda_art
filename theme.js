// Applied before the stylesheet even loads (classic script, not a module —
// see build.js) so a saved theme choice never flashes the wrong colors
// first. The actual toggle button lives in nav.js; this only ever reads.
try {
  const saved = localStorage.getItem("theme");
  if (saved) document.documentElement.dataset.theme = saved;
} catch (e) {}
