const prev = document.querySelector('a[rel="prev"]');
const next = document.querySelector('a[rel="next"]');
const frame = document.querySelector(".frame");

document.querySelector(".details-link")?.addEventListener("click", () => {
  document.querySelector(".work-columns")?.scrollIntoView({ block: "start" });
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.defaultPrevented) return;
  if (lightbox?.classList.contains("open") || e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (e.key === "ArrowLeft" && prev) prev.click();
  if (e.key === "ArrowRight" && next) next.click();
  if (
    e.key === " " &&
    frame &&
    lightbox &&
    (e.target === document.body || e.target === document.documentElement) &&
    matchMedia("(hover: hover)").matches
  ) {
    e.preventDefault();
    openLightbox(pickFullResHref());
  }
});

const toggle = document.querySelector(".theme-toggle");

function currentTheme() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
function labelToggle() {
  if (!toggle) return;
  const dark = currentTheme() === "dark";
  toggle.textContent = dark ? "○" : "●";
  toggle.setAttribute("aria-label", dark ? "switch to light" : "switch to dark");
}

if (toggle) {
  labelToggle();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", labelToggle);
  toggle.addEventListener("click", () => {
    const nextTheme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem("theme", nextTheme);
    } catch (e) {}
    labelToggle();
  });
}

const lightbox = document.querySelector(".lightbox");
const firstFormatLink = document.querySelector(".format-link");
function pickFullResHref() {
  const heroImg = frame?.querySelector("picture img");
  const currentSrc = heroImg?.currentSrc || heroImg?.src || "";
  const format = (currentSrc.match(/@(avif|webp|jpg|png)(?:\?|$)/) || [])[1];
  const link = format && document.querySelector(`.format-link[data-format="${format}"]`);
  return (link || firstFormatLink)?.href;
}

let openLightbox;
if (lightbox) {
  const backdrop = lightbox.querySelector(".lightbox-backdrop");
  const viewport = lightbox.querySelector(".lightbox-viewport");
  const lightboxImg = lightbox.querySelector(".lightbox-img");
  const closeBtn = lightbox.querySelector(".lightbox-close");
  const placeholder = document.querySelector(".frame .placeholder");

  let previousFocus;
  const background = [...document.body.children].filter((el) => el !== lightbox && el.tagName !== "SCRIPT");
  openLightbox = function (src) {
    if (!src) return;
    previousFocus = document.activeElement;
    background.forEach((el) => { el.inert = true; });
    lightboxImg.src = src;
    lightbox.classList.remove("zoomed");
    if (placeholder) backdrop.style.backgroundImage = `url('${placeholder.src}')`;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    viewport.scrollTo(0, 0);
    closeBtn.focus();
  };

  function closeLightbox() {
    lightbox.classList.remove("open", "zoomed");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    background.forEach((el) => { el.inert = false; });
    previousFocus?.focus();
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
    if (e.key === "Tab" && lightbox.classList.contains("open")) { e.preventDefault(); closeBtn.focus(); }
    if (e.key === "Escape" && lightbox.classList.contains("open")) closeLightbox();
  });
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
if (frame) {
  frame.addEventListener("click", (e) => {
    if (e.target.closest("a, button")) return;
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
  const heroImg = frame.querySelector("picture img");
  const hintTimers = [];
  let hintCancelled = false;
  function clearHint() {
    hintCancelled = true;
    frame.classList.remove("show-keyboard-hint");
    hintTimers.forEach(clearTimeout);
    hintTimers.length = 0;
    document.querySelectorAll(".hint-zone.active, .nav-hint.active").forEach((el) => el.classList.remove("active"));
  }
  window.addEventListener("pagehide", clearHint);

  if (heroImg) {
    const playHint = async () => {
      try { await heroImg.decode(); } catch { return; }
      if (hintCancelled) return;
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        if (!frame.querySelector(".keyboard-hint")) return;
        try {
          if (sessionStorage.getItem("keyboard-hint-shown") === "1") return;
        } catch {}
        hintTimers.push(setTimeout(() => {
          frame.classList.add("show-keyboard-hint");
          try { sessionStorage.setItem("keyboard-hint-shown", "1"); } catch {}
        }, 150));
        hintTimers.push(setTimeout(() => frame.classList.remove("show-keyboard-hint"), 2150));
        return;
      }
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let alreadyShown = false;
      try {
        alreadyShown = sessionStorage.getItem("nav-hint-shown") === "1";
        if (!alreadyShown) sessionStorage.setItem("nav-hint-shown", "1");
      } catch (e) {}
      if (alreadyShown) return;
      const targets = [frame.querySelector(".hint-right"), frame.querySelector(".hint-left"), frame.querySelector(".hint-center")];

      const hold = 550; // ms each zone stays lit
      const gap = 250; // ms between one zone fading out and the next lighting up
      let t = 1000; // initial pause so the flash doesn't read as part of loading
      for (const el of targets) {
        if (!el) continue;
        const onAt = t;
        const offAt = t + hold;
        hintTimers.push(setTimeout(() => el.classList.add("active"), onAt));
        hintTimers.push(setTimeout(() => el.classList.remove("active"), offAt));
        t = offAt + gap;
      }
    };
    if (heroImg.complete) playHint();
    else heroImg.addEventListener("load", playHint, { once: true });
  }
}
