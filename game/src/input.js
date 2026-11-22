// Keyboard and mouse input. Held keys steer the thief; one-shot presses
// (start, restart, pause, sneak toggle, coin toss) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost
// and never counted twice. A mouse click is an aim: the loop reads where
// the pointer is in playfield coordinates and tosses a coin there.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SNEAK = 4;
export const ACTION_TOSS = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const SNEAK = new Set(['ShiftLeft', 'ShiftRight', 'KeyC']);

export function createInput(canvas, toField) {
  const held = { left: false, right: false, up: false, down: false };
  let actions = 0;
  let tossPoint = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (SNEAK.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SNEAK;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    held.left = false;
    held.right = false;
    held.up = false;
    held.down = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    if (point) {
      tossPoint = point;
      actions |= ACTION_TOSS;
    } else {
      // A click outside the playfield still starts / restarts the game.
      actions |= ACTION_CONFIRM;
    }
  });

  return {
    /** Steering direction as { x, y }, each -1, 0 or 1, normalised by the caller. */
    direction() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Where the last toss click aimed, in playfield coordinates (or null). */
    takeTossPoint() {
      const point = tossPoint;
      tossPoint = null;
      return point;
    },
  };
}
