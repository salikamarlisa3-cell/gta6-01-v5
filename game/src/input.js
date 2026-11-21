// input.js — keyboard + mouse state. One shared object the whole game polls;
// pointer lock is requested by main when play starts, mouse deltas accumulate here.

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    keys,
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    locked: false,
    down(code) { return keys.has(code); },
    axis() {
      // Movement axes in -1..1 from WASD / arrows.
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    consumeMouse() {
      const d = { dx: input.mouseDX, dy: input.mouseDY };
      input.mouseDX = 0; input.mouseDY = 0;
      return d;
    },
  };

  const pressHandlers = [];
  input.onPress = (fn) => pressHandlers.push(fn);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    for (const fn of pressHandlers) fn(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) input.mouseDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (input.locked) {
      input.mouseDX += e.movementX || 0;
      input.mouseDY += e.movementY || 0;
    }
  });
  input.requestLock = () => { if (!input.locked && !window.__MF_HEADLESS) canvas.requestPointerLock(); };
  input.releaseLock = () => { if (input.locked) document.exitPointerLock(); };
  return input;
}
