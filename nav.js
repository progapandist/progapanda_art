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

// ---- theme toggle -----------------------------------------------------

const toggle = document.querySelector(".theme-toggle");

function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

// Plain geometric glyphs, not emoji — filled circle shows when light (click
// to go dark), hollow circle shows when dark (click to go light).
function labelToggle() {
  if (!toggle) return;
  const dark = currentTheme() === "dark";
  toggle.textContent = dark ? "○" : "●";
  toggle.setAttribute("aria-label", dark ? "switch to light" : "switch to dark");
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

// ---- lightbox: full-resolution viewer ----------------------------------
// Progressive enhancement here too: every format link's href already points
// straight at the real image, so a modified click (new tab, save-as) or no
// JS at all falls through to a completely normal link.

const lightbox = document.querySelector(".lightbox");
const firstFormatLink = document.querySelector(".format-link");

// The hero <picture> already made the real avif-vs-webp-vs-jpg call for
// this browser (via its <source type="image/..."> negotiation) — reuse
// that instead of re-detecting: whatever format the visible hero image
// resolved to is the one the lightbox opens at, so avif is the default
// everywhere it's supported and a browser that can't decode it silently
// gets webp/jpg instead, no probing required.
function pickFullResHref() {
  const heroImg = frame && frame.querySelector("picture img");
  const currentSrc = (heroImg && (heroImg.currentSrc || heroImg.src)) || "";
  const format = (currentSrc.match(/@(avif|webp|jpg|png)$/) || [])[1];
  const link = format && document.querySelector(`.format-link[href$="@${format}"]`);
  return (link || firstFormatLink)?.href;
}

if (lightbox) {
  const backdrop = lightbox.querySelector(".lightbox-backdrop");
  const viewport = lightbox.querySelector(".lightbox-viewport");
  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  // The same tiny blurred placeholder already sitting behind the hero
  // image — no extra fetch needed for the lightbox's own backdrop.
  const placeholder = document.querySelector(".frame .placeholder");

  var openLightbox = function (src) {
    lightboxImg.src = src;
    lightbox.classList.remove("zoomed");
    if (placeholder) backdrop.style.backgroundImage = `url('${placeholder.src}')`;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  function closeLightbox() {
    lightbox.classList.remove("open", "zoomed");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  document.querySelectorAll(".format-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      openLightbox(link.href);
    });
  });

  closeBtn.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("open")) closeLightbox();
  });

  // Click (not drag) toggles fit <-> zoomed. Touch panning is native (see
  // touch-action on .lightbox-viewport in style.css) and a touch drag
  // already suppresses the browser's own synthetic click afterward, so
  // only the mouse case needs the "was this a click or a drag" check —
  // mousemove doubles as the pan itself while a drag is in progress.
  let mouseDown = false;
  let dragged = false;
  let startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;

  viewport.addEventListener("mousedown", (e) => {
    mouseDown = true;
    dragged = false;
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = viewport.scrollLeft;
    startScrollTop = viewport.scrollTop;
  });

  window.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragged = true;
    if (dragged) {
      viewport.scrollLeft = startScrollLeft - dx;
      viewport.scrollTop = startScrollTop - dy;
    }
  });

  window.addEventListener("mouseup", () => {
    mouseDown = false;
  });

  viewport.addEventListener("click", () => {
    if (dragged) {
      dragged = false;
      return;
    }
    lightbox.classList.toggle("zoomed");
    if (!lightbox.classList.contains("zoomed")) {
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
    }
  });
}

// Clicking the hero image itself: on a hover-capable pointer (desktop/
// trackpad), it opens the same product-style lightbox as a format link — a
// mouse already has prev/next via the arrow keys and the footer links, so
// the image itself is free to mean "zoom" instead of "navigate". On touch,
// hover doesn't exist and there's no swipe gesture any more either, so the
// image itself carries all the navigation: left ~20% back, right ~20%
// forward (same edge zones the old gallery view used), the middle opens
// the lightbox exactly like a desktop click does.
if (frame) {
  frame.addEventListener("click", (e) => {
    if (matchMedia("(hover: hover)").matches) {
      if (lightbox) openLightbox(pickFullResHref());
      return;
    }
    const rect = frame.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 0.2) {
      if (prev) prev.click();
    } else if (ratio > 0.8) {
      if (next) next.click();
    } else if (lightbox) {
      openLightbox(pickFullResHref());
    }
  });
}
