// Progressive enhancement only: every interaction here just clicks a link
// that already works without JS. Loaded on every page (theme toggle needs
// to work everywhere); the prev/next/frame bits are no-ops on pages that
// don't have them.
const prev = document.querySelector('a[rel="prev"]');
const next = document.querySelector('a[rel="next"]');
const frame = document.querySelector(".frame");

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

// Tapping/clicking the image itself does the same thing a swipe does —
// left ~20% goes back, the rest goes forward, same zones the old gallery
// view used. A real page navigation follows (this is a plain <a>.click(),
// not a fetch), so the CSS view-transition handles what happens visually;
// this only decides which direction.
if (frame) {
  frame.addEventListener("click", (e) => {
    const rect = frame.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.2) {
      if (prev) prev.click();
    } else if (next) {
      next.click();
    }
  });
}

// ---- theme toggle -----------------------------------------------------

const toggle = document.querySelector(".theme-toggle");

function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function labelToggle() {
  if (toggle) toggle.textContent = currentTheme() === "dark" ? "light mode" : "dark mode";
}

if (toggle) {
  labelToggle();
  toggle.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem("theme", nextTheme);
    } catch (e) {}
    labelToggle();
  });
}
