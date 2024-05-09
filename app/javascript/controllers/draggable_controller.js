import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = { startX: Number, startY: Number, dragging: Boolean };

  connect() {
    this.draggingValue = false; // Initializes dragging as false
    // Ensure the element is positioned correctly
    // Note: Ensure your element has a defined width and height to avoid "growing" effects
    this.element.style.position = "absolute"; // This is critical for absolute movement

    console.log("Hello from DraggableController");
  }

  mousedown(e) {
    this.draggingValue = true;
    // Compute the initial difference between click location and element's top-left corner
    this.startXValue = e.clientX - this.element.offsetLeft;
    this.startYValue = e.clientY - this.element.offsetTop;
    this.element.style.cursor = "grabbing";
    this.element.style.filter = "invert(1)";
  }
  mousemove(e) {
    if (!this.draggingValue) return;

    // Position the element based on cursor location minus the initial offsets
    const x = e.clientX - this.startXValue;
    const y = e.clientY - this.startYValue;

    // Update position, ensuring the box stays in bounds
    const maxX = window.innerWidth - this.element.offsetWidth;
    const maxY = window.innerHeight - this.element.offsetHeight;

    this.element.style.left = Math.max(0, Math.min(maxX, x)) + "px";
    this.element.style.top = Math.max(0, Math.min(maxY, y)) + "px";
  }

  mouseup() {
    this.draggingValue = false;
    this.element.style.cursor = "grab";
    this.element.style.filter = "invert(0)";
  }
}
