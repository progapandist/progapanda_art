import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["handle"];

  connect() {
    this.dragThreshold = 3;
    this.dragging = false;
    this.pointerDown = false;
    this.didDrag = false;
    this.startX = 0;
    this.startY = 0;
    this.originX = 0;
    this.originY = 0;

    this.interactiveStartEl = this.element;

    this.onMousedown = this.mousedown.bind(this);
    this.onMousemove = this.mousemove.bind(this);
    this.onMouseup = this.mouseup.bind(this);

    this.interactiveStartEl.addEventListener("mousedown", this.onMousedown);
    this.interactiveStartEl.addEventListener("touchstart", this.onMousedown, {
      passive: false,
    });
    document.addEventListener("mousemove", this.onMousemove);
    document.addEventListener("touchmove", this.onMousemove, {
      passive: false,
    });
    document.addEventListener("mouseup", this.onMouseup);
    document.addEventListener("touchend", this.onMouseup);
  }

  disconnect() {
    this.interactiveStartEl.removeEventListener("mousedown", this.onMousedown);
    this.interactiveStartEl.removeEventListener("touchstart", this.onMousedown);
    document.removeEventListener("mousemove", this.onMousemove);
    document.removeEventListener("touchmove", this.onMousemove);
    document.removeEventListener("mouseup", this.onMouseup);
    document.removeEventListener("touchend", this.onMouseup);
  }

  mousedown(e) {
    if (e.target.closest("a, button")) return;

    const rect = this.element.getBoundingClientRect();
    this.element.style.width = `${rect.width}px`;
    this.element.style.left = `${rect.left}px`;
    this.element.style.top = `${rect.top}px`;
    this.element.style.right = "auto";
    this.element.style.bottom = "auto";

    this.pointerDown = true;
    this.dragging = false;
    this.didDrag = false;

    const event = e.type === "touchstart" ? e.touches[0] : e;
    this.startX = event.clientX - this.element.offsetLeft;
    this.startY = event.clientY - this.element.offsetTop;
    this.originX = event.clientX;
    this.originY = event.clientY;

    document.dispatchEvent(new CustomEvent("infobox:dragstart"));
    e.preventDefault();
    e.stopPropagation();
  }

  startDragging() {
    this.dragging = true;
    this.element.style.cursor = "grabbing";
    this.element.style.filter = "invert(1)";
  }

  mousemove(e) {
    if (!this.pointerDown) return;

    const event = e.type === "touchmove" ? e.touches[0] : e;

    if (!this.dragging) {
      const dx = event.clientX - this.originX;
      const dy = event.clientY - this.originY;
      if (Math.hypot(dx, dy) < this.dragThreshold) return;
      this.startDragging();
    }

    this.didDrag = true;
    e.preventDefault();
    const x = event.clientX - this.startX;
    const y = event.clientY - this.startY;
    const maxX = window.innerWidth - this.element.offsetWidth;
    const maxY = window.innerHeight - this.element.offsetHeight;

    this.element.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
    this.element.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
  }

  mouseup() {
    if (!this.pointerDown) return;

    this.pointerDown = false;
    this.dragging = false;
    this.didDrag = false;

    this.element.style.cursor = "grab";
    this.element.style.filter = "invert(0)";

    document.dispatchEvent(new CustomEvent("infobox:dragend"));
  }
}
