// Every tuning number and colour in one place. The level is a fixed 40x22
// grid of 32px tiles (1280x704) centred on the 1280x720 field; the page
// scales the canvas to the window, so no rule below depends on the screen.

export const FIELD = { width: 1280, height: 720 };
export const TILE = 32;
export const COLS = 40;
export const ROWS = 22;
export const ORIGIN_Y = 8;

export const STEP = 1 / 60;

export const PLAYER = {
  width: 22,
  height: 28,
  runSpeed: 252,
  accel: 2600,
  airAccel: 1700,
  friction: 2400,
  gravity: 1900,
  maxFall: 660,
  jumpVelocity: 645,
  coyoteTime: 0.09,
  jumpBuffer: 0.12,
  jumpCut: 0.45,
  flipCooldown: 0.55,
  flipAnimTime: 0.22,
};

export const WORLD = {
  respawnDelay: 0.5,
  crumbleDelay: 0.35,
  crumbleRespawn: 2.2,
  sawRadius: 14,
  shardRadius: 10,
  portalRadius: 20,
  checkpointRadius: 26,
  keyRadius: 16,
};

/** On-screen buttons (logical coordinates), shared by the renderer and input. */
export const BUTTONS = {
  mute: { x: 1112, y: 6, w: 46, h: 34 },
  restart: { x: 1164, y: 6, w: 46, h: 34 },
  pause: { x: 1216, y: 6, w: 46, h: 34 },
  flip: { x: 74, y: 638, r: 44 },
  jump: { x: 182, y: 646, r: 36 },
};

export const PALETTE = {
  page: '#06182e',
  backdrop: '#0a2c54',
  backdropDeep: '#07203f',
  gridMinor: 'rgba(234, 244, 255, 0.055)',
  gridMajor: 'rgba(234, 244, 255, 0.11)',
  annotation: 'rgba(120, 180, 230, 0.5)',
  line: '#eaf4ff',
  lineDim: '#9db8d6',
  cyan: '#35d0ff',
  cyanDim: '#1b7fa8',
  cyanFaint: 'rgba(53, 208, 255, 0.16)',
  gold: '#ffc94d',
  goldDeep: '#e0a52e',
  goldFaint: 'rgba(255, 201, 77, 0.16)',
  hazard: '#ff7a6b',
  hazardDeep: '#c94a3e',
  text: '#f2f8ff',
  muted: '#8fb0d0',
  dim: '#5d7d9e',
  panel: 'rgba(6, 20, 38, 0.88)',
  panelEdge: '#3f6d9e',
  suit: '#f4f8ff',
  suitShade: '#b9cde4',
  visor: '#35d0ff',
  pack: '#ffc94d',
};

export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** Where progress (stars, unlocked levels) is kept between visits. */
export const PROGRESS_KEY = 'fallsides.progress.v1';
