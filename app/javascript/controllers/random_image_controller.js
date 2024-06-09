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
    appEnv: String,
    imgproxyUrl: String,
  };

  static outlets = ["sessions"];

  connect() {
    console.log(this.sessionsOutlet.sessionIdValue);

    console.log(
      "Hello from RandomImageController, imgproxyUrl:",
      this.imgproxyUrlValue
    );

    this.imageDisplayTarget.src = this.imgproxyUrlValue;

    // Add event listener to intercept clicks on the viewport
    document.addEventListener("click", this.handleClick.bind(this));

    // Update the page URL with the current slug value while keeping all query parameters
    const currentSlug = this.slugValue;
    console.log("slug value", currentSlug);

    let currentPath = window.location.pathname;

    if (/\/works\/\w+/.test(currentPath)) {
      // If "/works/smth" is present, replace it with "/works/${currentSlug}"
      currentPath = currentPath.replace(
        /\/works\/\w+/,
        `/works/${currentSlug}`
      );
    } else {
      // Otherwise, prepend "/works/${currentSlug}" to the current path
      currentPath = `/works/${currentSlug}${currentPath}`;
    }

    console.log("currentPath", currentPath);

    const newURL = `${window.location.origin}${currentPath}${window.location.search}${window.location.hash}`;
    window.history.replaceState({}, "", newURL);
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

        // Extract the existing prev_slug and session_id values
        const prevSlug = url.searchParams.get("ps");
        const sessionId = url.searchParams.get("i");

        // Update the session_id value if it's not already present
        if (!sessionId) {
          url.searchParams.set("i", this.sessionsOutlet.sessionIdValue);
        }

        // Construct the new URL with the updated query parameters
        let newURL = `/works/rand?ps=${prevSlug || this.slugValue}&i=${sessionId || this.sessionsOutlet.sessionIdValue}`;

        // Send a Turbo visit request to the new URL
        Turbo.visit(newURL, {
          action: "replace",
        });
      }
    }
  }
}
