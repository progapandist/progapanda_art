// random_image_controller.js
import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = {
    sessionId: String,
  };

  connect() {
    console.log(
      "Connected to the session controller, session ID:",
      this.sessionIdValue
    );

    // Get the current session id
    const currentSessionId = this.sessionIdValue;

    // Get the current URL components
    const url = new URL(window.location.href);

    // Append the session id as a query parameter
    url.searchParams.set("i", currentSessionId);

    // Replace the current URL with the updated URL
    window.history.replaceState({}, "", url.toString());
  }
}
