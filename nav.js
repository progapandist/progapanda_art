// Progressive enhancement only: the prev/next links already work without
// this. Arrow keys just click whichever one is present.
const prev = document.querySelector('a[rel="prev"]');
const next = document.querySelector('a[rel="next"]');

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "ArrowLeft" && prev) prev.click();
  if (e.key === "ArrowRight" && next) next.click();
});
