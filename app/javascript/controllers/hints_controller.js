import { Controller } from "@hotwired/stimulus";
export default class extends Controller {
  connect() {
    this.addHintMessage();
    window.addEventListener("resize", this.updatePosition.bind(this));
  }

  disconnect() {
    window.removeEventListener("resize", this.updatePosition.bind(this));
  }

  addHintMessage() {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    this.hint = document.createElement("div");

    this.hint.innerText = "click to 👉, click left edge to 👈";

    this.hint.innerText += isMobile
      ? " | flip phone to resize"
      : " | drag corner to resize ⇲";

    this.hint.style.position = "fixed";
    this.hint.style.bottom = "10px";
    this.hint.style.right = "10px";
    this.hint.style.fontFamily = "monospace";
    this.hint.style.mixBlendMode = "difference"; // For better visibility
    this.hint.style.backgroundColor = "rgba(255, 0, 255, 100)"; // Fuchsia with opacity
    this.hint.style.color = "white";
    this.hint.style.padding = "5px";
    this.hint.style.borderRadius = "5px";
    this.hint.style.zIndex = "1000"; // Ensures it's on top of other elements if required

    document.body.appendChild(this.hint);
  }

  updatePosition() {
    if (this.hint) {
      this.hint.style.bottom = "10px";
      this.hint.style.right = "10px";
    }
  }
}
