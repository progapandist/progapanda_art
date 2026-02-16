import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    this.dragging = false;
    this.startX = 0;
    this.startY = 0;

    this.onMousedown = this.mousedown.bind(this);
    this.onMousemove = this.mousemove.bind(this);
    this.onMouseup = this.mouseup.bind(this);

    this.element.addEventListener("mousedown", this.onMousedown);
    this.element.addEventListener("touchstart", this.onMousedown, { passive: false });
    document.addEventListener("mousemove", this.onMousemove);
    document.addEventListener("touchmove", this.onMousemove, { passive: false });
    document.addEventListener("mouseup", this.onMouseup);
    document.addEventListener("touchend", this.onMouseup);
  }

  disconnect() {
    this.element.removeEventListener("mousedown", this.onMousedown);
    this.element.removeEventListener("touchstart", this.onMousedown);
    document.removeEventListener("mousemove", this.onMousemove);
    document.removeEventListener("touchmove", this.onMousemove);
    document.removeEventListener("mouseup", this.onMouseup);
    document.removeEventListener("touchend", this.onMouseup);
  }

  mousedown(e) {
    this.dragging = true;
    const event = e.type === "touchstart" ? e.touches[0] : e;
    this.startX = event.clientX - this.element.offsetLeft;
    this.startY = event.clientY - this.element.offsetTop;
    this.element.style.cursor = "grabbing";
    this.element.style.filter = "invert(1)";
  }

  mousemove(e) {
    if (!this.dragging) return;
    e.preventDefault();
    const event = e.type === "touchmove" ? e.touches[0] : e;
    const x = event.clientX - this.startX;
    const y = event.clientY - this.startY;
    const maxX = window.innerWidth - this.element.offsetWidth;
    const maxY = window.innerHeight - this.element.offsetHeight;

    this.element.style.left = `${Math.max(0, Math.min(maxX, x))}px`;
    this.element.style.top = `${Math.max(0, Math.min(maxY, y))}px`;
  }

  mouseup() {
    this.dragging = false;
    this.element.style.cursor = "grab";
    this.element.style.filter = "invert(0)";
  }
}
