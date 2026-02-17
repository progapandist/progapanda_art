import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = [
    "currentLayer",
    "currentBg",
    "currentMain",
    "incomingLayer",
    "incomingBg",
    "incomingMain",
    "infoCard",
    "infoTitle",
    "infoLocation",
    "infoYear",
    "infoDescription",
    "infoDimensions",
    "infoPermalink",
    "progressBar",
  ];

  static values = {
    slug: String,
    imgproxyUrl: String,
    maxPage: Number,
    currentPage: Number,
    title: String,
    location: String,
    year: String,
    description: String,
    dimensions: String,
    permalink: String,
  };

  connect() {
    this.transitioning = false;
    this.infoVisible =
      localStorage.getItem("gallery-info-visible") !== "false";

    // Load initial image into current layer
    const url = this.imgproxyUrlValue;
    this.currentBgTarget.src = this.bgUrl(url);
    this.currentMainTarget.src = this.mainUrl(url);
    this.currentLayerTarget.style.opacity = "1";

    // Apply info visibility preference
    if (!this.infoVisible) {
      this.infoCardTarget.style.opacity = "0";
      this.infoCardTarget.style.pointerEvents = "none";
    }

    // Bind event handlers
    this.onClick = this.handleClick.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
    this.onTouchstart = this.handleTouchstart.bind(this);
    this.onTouchend = this.handleTouchend.bind(this);
    this.onDblclick = this.handleDblclick.bind(this);
    this.resizeTimer = null;
    this.onResize = this.handleResizeDebounced.bind(this);

    document.addEventListener("click", this.onClick);
    document.addEventListener("keydown", this.onKeydown);
    document.addEventListener("touchstart", this.onTouchstart, {
      passive: true,
    });
    document.addEventListener("touchend", this.onTouchend, { passive: true });
    document.addEventListener("dblclick", this.onDblclick);
    window.addEventListener("resize", this.onResize);

    // Preload next after current loads
    this.currentMainTarget.addEventListener(
      "load",
      () => this.preloadNext(),
      { once: true },
    );
  }

  disconnect() {
    document.removeEventListener("click", this.onClick);
    document.removeEventListener("keydown", this.onKeydown);
    document.removeEventListener("touchstart", this.onTouchstart);
    document.removeEventListener("touchend", this.onTouchend);
    document.removeEventListener("dblclick", this.onDblclick);
    window.removeEventListener("resize", this.onResize);
    clearTimeout(this.resizeTimer);
  }

  // --- Navigation ---

  handleClick(event) {
    if (event.target.closest("[data-controller='draggable']")) return;
    if (event.detail > 1) return; // ignore double-clicks

    const leftBoundary = window.innerWidth * 0.2;
    if (event.clientX < leftBoundary) {
      this.navigateBack();
    } else {
      this.navigateForward();
    }
  }

  handleKeydown(event) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
      case " ":
        event.preventDefault();
        this.navigateForward();
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        this.navigateBack();
        break;
      case "i":
      case "Escape":
        this.toggleInfo();
        break;
    }
  }

  handleTouchstart(event) {
    if (event.target.closest("[data-controller='draggable']")) return;
    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
  }

  handleTouchend(event) {
    if (!this.touchStartX) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    const dt = Date.now() - this.touchStartTime;

    this.touchStartX = null;

    // Only count horizontal swipes (min 50px, max 300ms, more horizontal than vertical)
    if (Math.abs(dx) > 50 && dt < 300 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        this.navigateForward();
      } else {
        this.navigateBack();
      }
    }
  }

  handleDblclick(event) {
    if (event.target.closest("[data-controller='draggable']")) return;
    this.toggleInfo();
  }

  navigateForward() {
    const page = this.currentPageValue;
    const nextPage = page >= this.maxPageValue ? 1 : page + 1;
    this.transitionTo(nextPage);
  }

  navigateBack() {
    const page = this.currentPageValue;
    if (page <= 1) return;
    this.transitionTo(page - 1);
  }

  // --- Crossfade transition ---

  async transitionTo(page) {
    if (this.transitioning) return;
    this.transitioning = true;

    try {
      const response = await fetch(`/works.json?page=${page}`);
      const data = await response.json();

      // Prepare URLs for both layers
      const bgSrc = this.bgUrl(data.imgproxy_url);
      const mainSrc = this.mainUrl(data.imgproxy_url);

      // Load images into incoming layer
      await this.loadImages(
        this.incomingBgTarget,
        this.incomingMainTarget,
        bgSrc,
        mainSrc,
      );

      // Update info, progress, and URL immediately as crossfade starts
      this.updateInfo(data);
      this.progressBarTarget.style.width = `${(data.page / data.max_page) * 100}%`;
      window.history.replaceState({}, "", data.permalink);

      // Crossfade
      this.incomingLayerTarget.style.opacity = "1";
      this.currentLayerTarget.style.opacity = "0";

      // Wait for CSS transition
      await new Promise((r) => setTimeout(r, 650));

      // Swap layer roles: incoming becomes current, current becomes incoming.
      // Disable transitions during the instant swap to prevent any flash.
      const oldCurrent = this.currentLayerTarget;
      const oldIncoming = this.incomingLayerTarget;
      oldCurrent.style.transition = "none";
      oldIncoming.style.transition = "none";

      // The incoming layer (now visible at opacity 1) becomes the new "current".
      // The old current layer (at opacity 0) becomes the new "incoming" for next time.
      // We swap by toggling data-gallery-target attributes.
      oldCurrent.dataset.galleryTarget = "incomingLayer";
      oldIncoming.dataset.galleryTarget = "currentLayer";

      // Also swap the child img targets
      const oldCurrentBg = this.currentBgTarget;
      const oldCurrentMain = this.currentMainTarget;
      const oldIncomingBg = this.incomingBgTarget;
      const oldIncomingMain = this.incomingMainTarget;
      oldCurrentBg.dataset.galleryTarget = "incomingBg";
      oldCurrentMain.dataset.galleryTarget = "incomingMain";
      oldIncomingBg.dataset.galleryTarget = "currentBg";
      oldIncomingMain.dataset.galleryTarget = "currentMain";

      // Re-enable transitions on next frame
      requestAnimationFrame(() => {
        this.currentLayerTarget.style.transition = "";
        this.incomingLayerTarget.style.transition = "";
      });

      // Update state
      this.currentPageValue = data.page;
      this.maxPageValue = data.max_page;
      this.slugValue = data.slug;
      this.imgproxyUrlValue = data.imgproxy_url;

      // Preload next
      this.preloadNext();
    } catch (e) {
      console.error("Gallery navigation failed:", e);
    } finally {
      this.transitioning = false;
    }
  }

  loadImages(bgImg, mainImg, bgSrc, mainSrc) {
    return new Promise((resolve) => {
      let loaded = 0;
      const onLoad = () => {
        loaded++;
        if (loaded >= 2) resolve();
      };

      bgImg.onload = onLoad;
      mainImg.onload = onLoad;
      bgImg.onerror = onLoad;
      mainImg.onerror = onLoad;
      bgImg.src = bgSrc;
      mainImg.src = mainSrc;
    });
  }

  updateInfo(data) {
    this.infoTitleTarget.textContent = data.title;
    this.infoLocationTarget.textContent = data.location;
    this.infoYearTarget.textContent = data.year;
    this.infoPermalinkTarget.href = data.permalink;

    if (data.description) {
      this.infoDescriptionTarget.textContent = data.description;
      this.infoDescriptionTarget.classList.remove("hidden");
    } else {
      this.infoDescriptionTarget.classList.add("hidden");
    }

    if (data.dimensions) {
      this.infoDimensionsTarget.textContent = data.dimensions;
      this.infoDimensionsTarget.classList.remove("hidden");
    } else {
      this.infoDimensionsTarget.classList.add("hidden");
    }
  }

  // --- Info card toggle ---

  toggleInfo() {
    this.infoVisible = !this.infoVisible;
    localStorage.setItem("gallery-info-visible", this.infoVisible);

    if (this.infoVisible) {
      this.infoCardTarget.style.opacity = "1";
      this.infoCardTarget.style.pointerEvents = "auto";
    } else {
      this.infoCardTarget.style.opacity = "0";
      this.infoCardTarget.style.pointerEvents = "none";
    }
  }

  // --- Responsive resize (debounced — only fires once after resize settles) ---

  handleResizeDebounced() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.handleResize(), 300);
  }

  handleResize() {
    const url = this.imgproxyUrlValue;
    this.currentBgTarget.src = this.bgUrl(url);
    this.currentMainTarget.src = this.mainUrl(url);
  }

  // Background: low-res fill image (will be blurred, so quality doesn't matter)
  bgUrl(url) {
    const w = Math.round(window.innerWidth * 0.5);
    const h = Math.round(window.innerHeight * 0.5);
    return url.replace(/rs:\w+:\d+:\d+/, `rs:fill:${w}:${h}`);
  }

  // Main: high-res fit image (no cropping, full artwork visible)
  mainUrl(url) {
    const w = window.innerWidth * 2;
    const h = window.innerHeight * 2;
    return url.replace(/rs:\w+:\d+:\d+/, `rs:fit:${w}:${h}`);
  }

  // --- Preloading ---

  preloadNext() {
    const nextPage =
      this.currentPageValue >= this.maxPageValue
        ? 1
        : this.currentPageValue + 1;

    fetch(`/works.json?page=${nextPage}`)
      .then((r) => r.json())
      .then((data) => {
        // Preload both bg and main images
        const bg = new Image();
        bg.src = this.bgUrl(data.imgproxy_url);
        const main = new Image();
        main.src = this.mainUrl(data.imgproxy_url);
      })
      .catch(() => {}); // silent fail for preload
  }
}
