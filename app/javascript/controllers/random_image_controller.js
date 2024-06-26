// random_image_controller.js
import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";

export default class extends Controller {
  static targets = ["imageDisplay"];

  static values = {
    slug: String,
    prevSlug: String,
    appEnv: String,
    imgproxyUrl: String,
    maxPage: Number,
  };

  static outlets = ["sessions"];

  connect() {
    this.imageDisplayTarget.src = this.imgproxyUrlValue;
    // Add event listener to intercept clicks on the viewport
    document.addEventListener("click", this.handleClick.bind(this));
  }

  handleClick(event) {
    // Calculate the width of the left 20% of the screen
    const leftBoundary = window.innerWidth * 0.2;

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

    if (!this.pageValue || this.pageValue === this.maxPageValue) {
      this.pageValue = 0;
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
