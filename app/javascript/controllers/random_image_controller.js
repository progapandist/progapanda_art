// random_image_controller.js
import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";

let FORMAT = "avif";
let RESIZE = "rs:fit:4000:3000/gravity:sm";
export default class extends Controller {
  static targets = ["imageDisplay"];

  static values = {
    slug: String,
    prevSlug: String,
  };

  static outlets = ["sessions"];

  connect() {
    console.log(this.sessionsOutlet.sessionIdValue);

    this.imageDisplayTarget.src = `https://imgproxy.progapanda.org/insecure/${RESIZE}/plain/local:///${this.slugValue}@${FORMAT}`;
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
    // Calculate the width of the left 20% of the screen
    const leftBoundary = window.innerWidth * 0.2;

    // Check if the click target is the draggable box or its children
    if (!event.target.closest("[data-controller='draggable']")) {
      // Check if the click target is the image element
      if (event.target === this.imageDisplayTarget) {
        // Get the current URL
        const url = new URL(window.location.href);

        // Check if the click occurred in the left 20% of the screen
        if (event.pageX < leftBoundary) {
          // Extract the existing prev_slug and session_id values
          const sessionId = url.searchParams.get("session_id");

          // Update the session_id value if it's not already present
          if (!sessionId) {
            url.searchParams.set(
              "session_id",
              this.sessionsOutlet.sessionIdValue
            );
          }

          // Construct the new URL with the updated query parameters
          let newURL = `/works/${this.prevSlugValue}?prev_slug=${this.slugValue}&session_id=${sessionId || this.sessionsOutlet.sessionIdValue}`;
          // Send a Turbo visit request to the updated URL
          Turbo.visit(newURL, {
            action: "replace",
          });
        } else {
          // Extract the existing prev_slug and session_id values
          const prevSlug = url.searchParams.get("prev_slug");
          const sessionId = url.searchParams.get("session_id");

          // Update the session_id value if it's not already present
          if (!sessionId) {
            url.searchParams.set(
              "session_id",
              this.sessionsOutlet.sessionIdValue
            );
          }

          // Construct the new URL with the updated query parameters
          let newURL = `/works/rand?prev_slug=${prevSlug || this.slugValue}&session_id=${sessionId || this.sessionsOutlet.sessionIdValue}`;

          // Send a Turbo visit request to the new URL
          Turbo.visit(newURL, {
            action: "replace",
          });
        }
      }
    }
  }
}
