// Keyboard and pointer input. Held keys give run direction and jump-hold
// (for variable jump height); one-shot presses (jump, flip, pause, restart,
// mute, menu moves) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost or doubled. Pointer state is exposed
// for the on-screen buttons, which the screens hit-test themselves.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_JUMP = 2;
export const ACTION_JUMP_UP = 4;
export const ACTION_FLIP = 8;
export const ACTION_PAUSE = 16;
export const ACTION_RESTART = 32;
export const ACTION_MUTE = 64;
export const ACTION_LEFT = 128;
export const ACTION_RIGHT = 256;

const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);
const JUMP_KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);
const FLIP_KEYS = new Set(['KeyF', 'ShiftLeft', 'ShiftRight', 'KeyJ']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerDown = false;
  let click = null;

  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * FIELD.width,
      y: ((clientY - rect.top) / rect.height) * FIELD.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT_KEYS.has(event.code)) {
      held.add(event.code);
      if (!event.repeat) actions |= ACTION_LEFT;
      event.preventDefault();
      return;
    }
    if (RIGHT_KEYS.has(event.code)) {
      held.add(event.code);
      if (!event.repeat) actions |= ACTION_RIGHT;
      event.preventDefault();
      return;
    }
    if (JUMP_KEYS.has(event.code)) {
      held.add(event.code);
      if (!event.repeat) actions |= ACTION_JUMP;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (FLIP_KEYS.has(event.code)) {
      actions |= ACTION_FLIP;
      event.preventDefault();
    } else if (event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
    } else if (PAUSE_KEYS.has(event.code)) {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  });

  window.addEventListener('keyup', (event) => {
    if (JUMP_KEYS.has(event.code) && held.has(event.code)) {
      actions |= ACTION_JUMP_UP;
    }
    held.delete(event.code);
  });

  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    held.clear();
    pointerDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    pointerX = point.x;
    pointerY = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(event.clientX, event.clientY);
    pointerX = point.x;
    pointerY = point.y;
    pointerDown = true;
    click = point;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointerDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function heldAny(keys) {
    for (const key of keys) if (held.has(key)) return true;
    return false;
  }

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    moveDirection() {
      return (heldAny(RIGHT_KEYS) ? 1 : 0) - (heldAny(LEFT_KEYS) ? 1 : 0);
    },
    jumpHeld() {
      return heldAny(JUMP_KEYS);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click point (logical coordinates), once, or null. */
    takeClick() {
      const taken = click;
      click = null;
      return taken;
    },
    /** Live pointer state, for held on-screen buttons. */
    pointer() {
      return { x: pointerX, y: pointerY, down: pointerDown };
    },
  };
}
