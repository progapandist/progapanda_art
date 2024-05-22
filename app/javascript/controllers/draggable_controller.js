import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = { startX: Number, startY: Number, dragging: Boolean };

  connect() {
    this.draggingValue = false; // Initializes dragging as false
    // Ensure the element is positioned correctly
    // Note: Ensure your element has a defined width and height to avoid "growing" effects
    this.element.style.position = "absolute"; // This is critical for absolute movement

    console.log("Hello from DraggableController");

    this.element.addEventListener("mousedown", this.mousedown.bind(this));
    this.element.addEventListener("touchstart", this.mousedown.bind(this));
    document.addEventListener("mousemove", this.mousemove.bind(this));
    document.addEventListener("touchmove", this.mousemove.bind(this));
    document.addEventListener("mouseup", this.mouseup.bind(this));
    document.addEventListener("touchend", this.mouseup.bind(this));
  }

  mousedown(e) {
    this.draggingValue = true;
    const event = e.type === "touchstart" ? e.touches[0] : e;
    this.startXValue = event.clientX - this.element.offsetLeft;
    this.startYValue = event.clientY - this.element.offsetTop;
    this.element.style.cursor = "grabbing";
    this.element.style.filter = "invert(1)";
  }

  mousemove(e) {
    if (!this.draggingValue) return;
    e.preventDefault(); // Prevent default behavior
    const event = e.type === "touchmove" ? e.touches[0] : e;
    const x = event.clientX - this.startXValue;
    const y = event.clientY - this.startYValue;
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
