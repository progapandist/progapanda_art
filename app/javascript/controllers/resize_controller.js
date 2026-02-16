import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static outlets = ["random-image"];

  connect() {
    this.updateImageDimensions();
    this.resizeHandler = this.throttle(
      this.updateImageDimensions.bind(this),
      500,
    );
    window.addEventListener("resize", this.resizeHandler);
  }

  disconnect() {
    window.removeEventListener("resize", this.resizeHandler);
  }

  updateImageDimensions() {
    if (!this.hasRandomImageOutlet) return;

    const controller = this.randomImageOutlet;
    const url = controller.imgproxyUrlValue;
    const resizeRegex = /rs:\w+:\d+:\d+/;

    const newUrl = url.replace(resizeRegex, (match) => {
      const parts = match.split(":");
      parts[2] = window.innerWidth * 2;
      parts[3] = window.innerHeight * 2;
      return parts.join(":");
    });

    controller.imageDisplayTarget.src = newUrl;
  }

  throttle(func, wait) {
    let timeout = null;
    let lastCall = 0;

    return (...args) => {
      const now = Date.now();

      if (lastCall + wait <= now) {
        lastCall = now;
        func(...args);
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          func(...args);
        }, wait - (now - lastCall));
      }
    };
  }
}
