// random_image_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["imageDisplay"];

  connect() {
    const imageUrlArray = [
      "http://localhost:8080/insecure/rs:fit:3000:2000/plain/local:///spam_render_1.png",
      "http://localhost:8080/insecure/rs:fit:3000:2000/plain/local:///date_line.png",
    ]; // Example image URL
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
