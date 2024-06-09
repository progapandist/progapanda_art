import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="resize"
export default class extends Controller {
  static outlets = ["random-image"];

  connect() {
    // Initial resize to set correct dimensions
    this.updateImageDimensions();
    // Resize event listener with throttling
    const throttledResize = this.throttle(
      this.updateImageDimensions.bind(this),
      500
    );
    window.addEventListener("resize", throttledResize);
    this.cleanup = () => {
      window.removeEventListener("resize", throttledResize);
    };
  }

  disconnect() {
    this.cleanup && this.cleanup();
  }

  updateImageDimensions() {
    const randomImageController = this.randomImageOutlet;
    if (randomImageController) {
      // Parse and update the image URL
      const url = new URL(randomImageController.imgproxyUrlValue);
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Regex to find resize parameters, regardless of their specific value
      const resizeRegex = /rs:\w+:\d+:\d+/;

      const newUrl = url.href.replace(resizeRegex, (match) => {
        const parts = match.split(":");
        parts[2] = viewportWidth * 2;
        parts[3] = viewportHeight * 2;
        return parts.join(":");
      });

      randomImageController.imageDisplayTarget.src = newUrl;
    }
  }

  throttle(func, wait) {
    let timeout = null;
    let lastCall = 0;

    return function (...args) {
      const now = new Date().getTime();

      if (lastCall + wait <= now) {
        lastCall = now;
        func(...args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(
          () => {
            lastCall = new Date().getTime();
            func(...args);
          },
          wait - (now - lastCall)
        );
      }
    };
  }
}
