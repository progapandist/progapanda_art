// random_image_controller.js
import { Controller } from "@hotwired/stimulus";

let FORMAT = "avif";
let RESIZE = "rs:fit:3000:2000";
export default class extends Controller {
  static targets = ["imageDisplay"];

  static values = {
    slug: String,
  };

  connect() {
    this.imageDisplayTarget.src = `http://localhost:8080/insecure/${RESIZE}/plain/local:///${this.slugValue}@${FORMAT}`;
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
