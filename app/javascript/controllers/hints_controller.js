import { Controller } from "@hotwired/stimulus";

// Connects to data-controller="hints"
export default class extends Controller {
  connect() {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get("i");

    // Check if the sessionId is present and if the hint has not been shown yet
    if (sessionId && !sessionStorage.getItem(`hintShown-${sessionId}`)) {
      this.showResizeHint();
      sessionStorage.setItem(`hintShown-${sessionId}`, "true");
    }
  }

  showResizeHint() {
    // Create overlay div
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    overlay.style.zIndex = "9999";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";

    // Create text element
    const text = document.createElement("div");
    text.innerText =
      "👋 EARTHLING. REMINDER! DRAG WINDOW CORNER ⇲ OR TURN PHONE TO RESIZE. CLICK TO SEE MORE. EOF. ENJOY ⇲ ⇲ ⇲ ⇲";
    text.style.color = "magenta";
    text.style.fontSize = "6em";
    text.style.fontWeight = "1000"; // Heavy script
    text.style.fontFamily = "system-ui, sans-serif"; // Optional: for better font rendering
    text.style.animation = "flashing 1s infinite"; // Add animation

    // Append text to overlay
    overlay.appendChild(text);

    // Append overlay to body
    document.body.appendChild(overlay);

    // Remove the overlay after 4.5 seconds
    setTimeout(() => {
      document.body.removeChild(overlay);
    }, 4500);

    // CSS Styles for flashing animation
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes flashing {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.1; }
      }
    `;
    document.head.appendChild(style);
  }
}
