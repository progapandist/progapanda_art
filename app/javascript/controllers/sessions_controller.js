import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = { sessionId: String };

  connect() {
    const url = new URL(window.location.href);
    url.searchParams.set("i", this.sessionIdValue);
    window.history.replaceState({}, "", url.toString());
  }
}
