// Progressive enhancement only: the prev/next links already work without
// this. Arrow keys just click whichever one is present.
const prev = document.querySelector('a[rel="prev"]');
const next = document.querySelector('a[rel="next"]');

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowLeft" && prev) prev.click();
  if (e.key === "ArrowRight" && next) next.click();
});

// A horizontal swipe does the same thing: short, fast, more sideways than
// vertical, so a scroll or a slow drag never gets mistaken for one.
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

document.addEventListener(
  "touchstart",
  (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchStartTime = Date.now();
  },
  { passive: true },
);

document.addEventListener(
  "touchend",
  (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const dt = Date.now() - touchStartTime;
    if (Math.abs(dx) < 50 || dt > 300 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0 && next) next.click();
    else if (dx > 0 && prev) prev.click();
  },
  { passive: true },
);
