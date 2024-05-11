// random_image_controller.js
import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";

let FORMAT = "avif";
let RESIZE = "rs:fit:4000:3000/gravity:sm";
export default class extends Controller {
  static targets = ["imageDisplay"];

  static values = {
    slug: String,
  };

  connect() {
    this.imageDisplayTarget.src = `http://localhost:8080/insecure/${RESIZE}/plain/local:///${this.slugValue}@${FORMAT}`;
    this.resize();

    // Add event listener to intercept clicks on the viewport
    document.addEventListener("click", this.handleClick.bind(this));
  }

  resize() {
    window.addEventListener("resize", () => {
      this.imageDisplayTarget.style.width = `${window.innerWidth}px`;
      this.imageDisplayTarget.style.height = `${window.innerHeight}px`;
    });
  }

  handleClick(event) {
    // Check if the click target is the draggable box or its children
    if (!event.target.closest("[data-controller='draggable']")) {
      // Check if the click target is the image element
      if (event.target === this.imageDisplayTarget) {
        // Send a Turbo visit request to works/rand if the previous slug is not present in query params
        if (!this.slugValue) {
          Turbo.visit("/works/rand");
        } else {
          // Send a Turbo visit request to works/rand with the previous slug in query params
          Turbo.visit(`/works/rand?prev_slug=${this.slugValue}`, {
            action: "replace",
          });
        }
      }
    }
  }
}
