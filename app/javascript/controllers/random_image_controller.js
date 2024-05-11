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

  static outlets = ["sessions"];

  connect() {
    console.log(this.sessionsOutlet.sessionIdValue);

    this.imageDisplayTarget.src = `http://localhost:8080/insecure/${RESIZE}/plain/local:///${this.slugValue}@${FORMAT}`;
    this.resize();

    // Update the page URL with the current slug value while keeping all query parameters
    const currentSlug = this.slugValue;
    const currentPath = window.location.pathname.replace(
      /\/works\/\w+/,
      `/works/${currentSlug}`
    );
    const currentURL = `${currentPath}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, "", currentURL);

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
        // Get the current URL
        const url = new URL(window.location.href);

        // Check if session_id is already present in the query parameters
        if (!url.searchParams.has("session_id")) {
          // Append session_id to the query parameters
          url.searchParams.append(
            "session_id",
            this.sessionsOutlet.sessionIdValue
          );
        }

        // Construct the new URL with the updated query parameters
        const newURL = url.toString();

        // Send a Turbo visit request to works/rand with the updated query parameters
        Turbo.visit(newURL, {
          action: "replace",
        });
      }
    }
  }
}
