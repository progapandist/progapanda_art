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

    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has("page")) {
      urlParams.set("page", 1);
    }
    // Add event listener to intercept clicks on the viewport
    document.addEventListener("click", this.handleClick.bind(this));
  }

  handleClick(event) {
    // Calculate the width of the left 50% of the screen
    const leftBoundary = window.innerWidth * 0.5;

    // Check if the click target is the draggable box or its children
    if (!event.target.closest("[data-controller='draggable']")) {
      // Check if the click occurred on the left half of the document
      if (event.clientX < leftBoundary) {
        this.navigateBack();
      } else {
        this.navigateForward();
      }
    }
  }

  navigateBack() {
    const url = new URL(window.location.href);
    const page = url.searchParams.get("page");
    this.pageValue = parseInt(page);

    if (!this.pageValue) {
      return;
    }

    if (this.pageValue > 1) {
      let newPage = this.pageValue - 1;
      Turbo.visit(
        `/works?page=${newPage}&i=${this.sessionsOutlet.sessionIdValue}`,
        {
          action: "replace",
        }
      );
    }
  }

  navigateForward() {
    const url = new URL(window.location.href);
    const page = url.searchParams.get("page");
    this.pageValue = parseInt(page);

    if (!this.pageValue) {
      this.pageValue = 1;
    }

    let newPage = this.pageValue + 1;
    Turbo.visit(
      `/works?page=${newPage}&i=${this.sessionsOutlet.sessionIdValue}`,
      {
        action: "replace",
      }
    );
  }
}
