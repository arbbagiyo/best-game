// Boot, the fixed-step loop, and the screen state machine: title, level
// select, play, pause, level complete, game complete. Input edges are taken
// once per frame and spent on the first fixed step, so a jump or flip press
// is never lost between frames. In ?shot= mode the staged scene is rendered
// frozen and window.__shotReady is set for the capture driver.

import { FIELD, STEP, BUTTONS, PROGRESS_KEY } from './config.js';
import { LEVELS } from './levels.js';
import {
  createInput,
  ACTION_CONFIRM,
  ACTION_JUMP,
  ACTION_FLIP,
  ACTION_PAUSE,
  ACTION_RESTART,
  ACTION_MUTE,
  ACTION_LEFT,
  ACTION_RIGHT,
} from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createRandom } from './rng.js';
import { createWorld, updateWorld, starsEarned } from './world.js';
import { createBackdrop, drawWorld, drawHUD } from './render.js';
import {
  drawTitle,
  drawLevelSelect,
  drawPause,
  drawComplete,
  drawGameComplete,
  TITLE_BUTTONS,
  PAUSE_BUTTONS,
  COMPLETE_BUTTONS,
  GAMECOMPLETE_BUTTONS,
  pointInRect,
  selectCardRect,
} from './screens.js';
import { applyEvents } from './effects.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
const shotKind = params.get('shot');

const input = createInput(canvas);
const audio = createAudio();
let particles = createParticles();
let random = createRandom(seed);

let progress = loadProgress();
let screen = 'title';
let selected = 0;
let world = null;
let backdrop = null;
let time = 0;
let panelTime = 0;
let lastStars = 0;
let moteTimer = 0.4;
let lastFrameDt = STEP;
let staged = null;
let shotFrames = 0;
let stepAcc = 0;

function loadProgress() {
  const fresh = { stars: {}, times: {}, deaths: {}, unlocked: 1 };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        stars: parsed.stars || {},
        times: parsed.times || {},
        deaths: parsed.deaths || {},
        unlocked: Math.max(1, Math.min(LEVELS.length, parsed.unlocked || 1)),
      };
    }
  } catch {
    // Private mode or a corrupt entry: play without saving.
  }
  return fresh;
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Saving is a nicety, never a blocker.
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function inCircle(point, circle) {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function firstUnfinished() {
  for (let i = 0; i < progress.unlocked; i += 1) {
    if (!progress.stars[i]) return i;
  }
  return 0;
}

function startLevel(index) {
  world = createWorld(index);
  backdrop = createBackdrop(world);
  particles.reset();
  selected = index;
  screen = 'play';
  stepAcc = 0;
  setStatus(`Level ${index + 1}, ${world.def.name}. Collect shards and reach the golden portal.`);
}

function onLevelComplete() {
  const stars = starsEarned(world);
  const i = world.index;
  progress.stars[i] = Math.max(progress.stars[i] || 0, stars);
  progress.times[i] = Math.min(progress.times[i] ?? Infinity, world.completeTime);
  progress.deaths[i] = Math.min(progress.deaths[i] ?? Infinity, world.deaths);
  progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, i + 2));
  saveProgress();
  lastStars = stars;
  panelTime = 0;
  screen = 'complete';
  setStatus(`Level ${i + 1} complete, ${stars} star${stars === 1 ? '' : 's'}.`);
}

function totals() {
  return {
    stars: Object.values(progress.stars).reduce((sum, n) => sum + n, 0),
    time: Object.values(progress.times).reduce((sum, n) => sum + n, 0),
    deaths: Object.values(progress.deaths).reduce((sum, n) => sum + n, 0),
  };
}

function handleScreenInput(actions, click) {
  if (actions & ACTION_MUTE) audio.toggleMute();

  if (screen === 'title') {
    if (click && pointInRect(click.x, click.y, TITLE_BUTTONS.levels)) {
      audio.uiClick();
      selected = Math.min(firstUnfinished(), progress.unlocked - 1);
      screen = 'select';
      return;
    }
    if (click || actions & ACTION_CONFIRM) startLevel(firstUnfinished());
    return;
  }

  if (screen === 'select') {
    if (actions & ACTION_LEFT) selected = Math.max(0, selected - 1);
    if (actions & ACTION_RIGHT) selected = Math.min(progress.unlocked - 1, selected + 1);
    if (actions & ACTION_PAUSE) {
      screen = 'title';
      return;
    }
    if (click) {
      for (let i = 0; i < LEVELS.length; i += 1) {
        if (pointInRect(click.x, click.y, selectCardRect(i)) && i < progress.unlocked) {
          startLevel(i);
          return;
        }
      }
    }
    if (actions & ACTION_CONFIRM) startLevel(selected);
    return;
  }

  if (screen === 'play') {
    if (actions & ACTION_PAUSE) {
      screen = 'pause';
      return;
    }
    if (actions & ACTION_RESTART) {
      startLevel(world.index);
      return;
    }
    if (click) {
      if (pointInRect(click.x, click.y, BUTTONS.mute)) audio.toggleMute();
      else if (pointInRect(click.x, click.y, BUTTONS.restart)) startLevel(world.index);
      else if (pointInRect(click.x, click.y, BUTTONS.pause)) screen = 'pause';
    }
    return;
  }

  if (screen === 'pause') {
    if (click && pointInRect(click.x, click.y, PAUSE_BUTTONS.restart)) {
      startLevel(world.index);
      return;
    }
    if (click && pointInRect(click.x, click.y, PAUSE_BUTTONS.levels)) {
      screen = 'select';
      return;
    }
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM || click) screen = 'play';
    return;
  }

  if (screen === 'complete') {
    if (click && pointInRect(click.x, click.y, COMPLETE_BUTTONS.retry)) {
      startLevel(world.index);
      return;
    }
    if (click && pointInRect(click.x, click.y, COMPLETE_BUTTONS.levels)) {
      screen = 'select';
      return;
    }
    if (actions & ACTION_RESTART) {
      startLevel(world.index);
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = 'select';
      return;
    }
    if (click || actions & ACTION_CONFIRM) {
      if (world.index >= LEVELS.length - 1) screen = 'gamecomplete';
      else startLevel(world.index + 1);
    }
    return;
  }

  if (screen === 'gamecomplete') {
    if (click && pointInRect(click.x, click.y, GAMECOMPLETE_BUTTONS.levels)) {
      screen = 'select';
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = 'select';
      return;
    }
    if (click || actions & ACTION_CONFIRM) startLevel(0);
  }
}

function stepPlay(actions, click, frameDt) {
  const pointer = input.pointer();
  const jumpButtonHeld = pointer.down && inCircle(pointer, BUTTONS.jump);
  const jumpPressed = (actions & ACTION_JUMP) !== 0 || (click !== null && inCircle(click, BUTTONS.jump));
  const flipPressed = (actions & ACTION_FLIP) !== 0 || (click !== null && inCircle(click, BUTTONS.flip));
  const base = {
    move: input.moveDirection(),
    jumpHeld: input.jumpHeld() || jumpButtonHeld,
    jumpPressed: false,
    flipPressed: false,
  };
  let steps = 0;
  stepAcc += frameDt;
  while (stepAcc >= STEP && steps < 4) {
    const snap = { ...base, jumpPressed: jumpPressed && steps === 0, flipPressed: flipPressed && steps === 0 };
    const events = [];
    updateWorld(world, STEP, snap, events);
    applyEvents(events, world, particles, random, audio);
    for (const event of events) {
      if (event.type === 'complete') onLevelComplete();
    }
    stepAcc -= STEP;
    steps += 1;
    if (screen !== 'play') break;
  }
  if (steps === 4) stepAcc = 0;
}

function render() {
  if (screen === 'title') {
    drawTitle(ctx, progress, time);
    return;
  }
  if (screen === 'select') {
    drawLevelSelect(ctx, progress, selected, time);
    return;
  }
  if (screen === 'gamecomplete') {
    drawGameComplete(ctx, totals());
    return;
  }
  const shake = screen === 'play' ? particles.shakeOffset(lastFrameDt, random) : { x: 0, y: 0 };
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawWorld(ctx, world, backdrop, particles, time);
  ctx.restore();
  if (screen === 'play') {
    drawHUD(ctx, world, { muted: audio.isMuted(), time });
  } else if (screen === 'pause') {
    drawHUD(ctx, world, { muted: audio.isMuted(), time });
    drawPause(ctx);
  } else if (screen === 'complete') {
    drawComplete(ctx, world, lastStars, world.index >= LEVELS.length - 1, panelTime);
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  lastFrameDt = frameDt;

  if (staged) {
    shotFrames += 1;
    render();
    if (shotFrames === 2) window.__shotReady = true;
    return;
  }

  time += frameDt;
  const actions = input.takeActions();
  const click = input.takeClick();
  if (actions !== 0 || click !== null) audio.unlock();
  handleScreenInput(actions, click);

  if (screen === 'play' && world) {
    stepPlay(actions, click, frameDt);
  } else if (screen === 'complete') {
    panelTime += frameDt;
  }

  moteTimer -= frameDt;
  if (moteTimer <= 0 && screen === 'play') {
    moteTimer = 0.5;
    particles.ember(random() * FIELD.width, FIELD.height - 16, random, 'rgba(53, 208, 255, 0.7)');
  }
  particles.update(frameDt);
  render();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') screen = 'pause';
});

// Screenshot staging: freeze a real run of the game's own code.
if (shotKind) {
  staged = stageShot(shotKind, seed);
  screen = staged.screen;
  world = staged.world;
  backdrop = staged.backdrop;
  particles = staged.particles;
  random = staged.random;
  progress = staged.progress;
  time = staged.time;
  panelTime = staged.panelTime;
  lastStars = staged.stars;
  window.__shotInfo = {
    kind: shotKind,
    player: world ? { x: world.player.x, y: world.player.y, gravity: world.player.gravity } : null,
    shardsTaken: world ? world.shardsTaken : 0,
    deaths: world ? world.deaths : 0,
    completed: world ? world.completed : false,
    time: world ? world.time : 0,
    stars: staged.stars,
  };
}

// A small handle for scripted play-tests; harmless in normal play.
window.__fallsides = {
  get screen() {
    return screen;
  },
  get world() {
    return world;
  },
  start(index) {
    startLevel(index);
  },
};

setStatus('FALLSIDE. Press Enter or click to start.');
requestAnimationFrame(frame);
