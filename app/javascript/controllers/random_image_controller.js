import { Controller } from "@hotwired/stimulus";
import { Turbo } from "@hotwired/turbo-rails";

export default class extends Controller {
  static targets = ["imageDisplay"];

  static values = {
    slug: String,
    imgproxyUrl: String,
    maxPage: Number,
  };

  static outlets = ["sessions"];

  connect() {
    this.imageDisplayTarget.src = this.imgproxyUrlValue;
    this.clickHandler = this.handleClick.bind(this);
    document.addEventListener("click", this.clickHandler);
  }

  disconnect() {
    document.removeEventListener("click", this.clickHandler);
  }

  handleClick(event) {
    if (event.target.closest("[data-controller='draggable']")) return;

    const leftBoundary = window.innerWidth * 0.2;
    if (event.clientX < leftBoundary) {
      this.navigateBack();
    } else {
      this.navigateForward();
    }
  }

  navigateBack() {
    const page = this.currentPage;
    if (!page || page <= 1) return;

    this.visitPage(page - 1);
  }

  navigateForward() {
    const page = this.currentPage;
    const nextPage = !page || page >= this.maxPageValue ? 1 : page + 1;
    this.visitPage(nextPage);
  }

  get currentPage() {
    const url = new URL(window.location.href);
    return parseInt(url.searchParams.get("page")) || 0;
  }

  visitPage(page) {
    const sessionId = this.sessionsOutlet.sessionIdValue;
    Turbo.visit(`/works?page=${page}&i=${sessionId}`, { action: "replace" });
  }
}
