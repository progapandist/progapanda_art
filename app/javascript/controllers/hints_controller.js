import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    this.addHintMessage();
  }

  disconnect() {
    this.hint?.remove();
  }

  addHintMessage() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    this.hint = document.createElement("div");
    this.hint.textContent = isMobile
      ? "tap to \u{1F449}, tap left edge to \u{1F448} | flip phone to resize"
      : "click to \u{1F449}, click left edge to \u{1F448} | drag corner to resize \u21F2";

    this.hint.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      font-family: monospace;
      background-color: rgba(255, 0, 255, 0.8);
      color: white;
      padding: 5px;
      border-radius: 5px;
      z-index: 1000;
    `;

    document.body.appendChild(this.hint);
  }
}
