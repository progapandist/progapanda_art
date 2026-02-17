import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    if (localStorage.getItem("gallery-hints-seen")) return;
    this.addHintMessage();
  }

  disconnect() {
    this.hint?.remove();
    clearTimeout(this.fadeTimer);
  }

  addHintMessage() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    this.hint = document.createElement("div");
    this.hint.textContent = isMobile
      ? "swipe or tap to navigate | press i for info"
      : "click or arrow keys to navigate | press i to toggle info";

    this.hint.style.cssText = `
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'Roboto Mono', monospace;
      font-size: 11px;
      background-color: rgba(0, 0, 0, 0.5);
      color: rgba(255, 255, 255, 0.7);
      padding: 6px 14px;
      border-radius: 4px;
      z-index: 200;
      transition: opacity 1s ease;
      pointer-events: none;
    `;

    document.body.appendChild(this.hint);

    this.fadeTimer = setTimeout(() => {
      this.hint.style.opacity = "0";
      localStorage.setItem("gallery-hints-seen", "true");
      setTimeout(() => this.hint?.remove(), 1000);
    }, 4000);
  }
}
