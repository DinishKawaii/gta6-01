// input.js — keyboard and mouse, consume-on-read.
// A key press is a single event: the fixed-step loop may run update()
// several times per frame, so a press must fire exactly once, not once
// per sub-step. held keys stay true while down; pressed keys are eaten
// by takePressed() the first time update() asks.
export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.pressed = new Set();
    this.camYaw = 0.6; // camera orbit angle, owned by the camera only
    this.camPitch = 0.42;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!this.held.has(k)) this.pressed.add(k);
      this.held.add(k);
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.held.delete(k);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.pressed.clear();
      this.dragging = false;
    });

    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.camYaw -= dx * 0.005;
      this.camPitch = Math.max(0.08, Math.min(1.1, this.camPitch + dy * 0.004));
    });
  }

  // True while the key is physically down.
  isDown(key) {
    return this.held.has(key);
  }

  // True once, the first update that asks after the press. Eaten on read.
  takePressed(key) {
    if (this.pressed.has(key)) {
      this.pressed.delete(key);
      return true;
    }
    return false;
  }

  // Clear the press queue at the end of each rendered frame.
  endFrame() {
    this.pressed.clear();
  }
}
