// random_image_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["imageDisplay"];

  connect() {
    const imageUrlArray = ["./IMG_1741@0.5x_chrome.png"]; // Example image URL
    const randomIndex = Math.floor(Math.random() * imageUrlArray.length);
    this.imageDisplayTarget.src = imageUrlArray[randomIndex];
    this.resize();
  }

  resize() {
    // Since this resize method is now called within connect, it's properly setting up the listener
    window.addEventListener("resize", () => {
      // Utilize this.imageDisplayTarget for consistency with Stimulus targets
      this.imageDisplayTarget.style.width = `${window.innerWidth}px`;
      this.imageDisplayTarget.style.height = `${window.innerHeight}px`;
    });
  }
}
