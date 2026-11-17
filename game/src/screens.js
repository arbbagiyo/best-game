// The screens between runs: title, level select, pause, level complete and
// game complete. Each draw function takes the data it shows and nothing else;
// the button rectangles are exported so the main loop can hit-test clicks
// against exactly what was drawn.

import { FIELD, PALETTE, FONT_UI, FONT_MONO, TILE, ORIGIN_Y } from './config.js';
import { LEVELS } from './levels.js';
import { drawSurveyor, formatTime } from './render.js';

export const TITLE_BUTTONS = {
  start: { x: 490, y: 505, w: 300, h: 52 },
  levels: { x: 490, y: 568, w: 300, h: 44 },
};

export const PAUSE_BUTTONS = {
  resume: { x: 490, y: 300, w: 300, h: 46 },
  restart: { x: 490, y: 358, w: 300, h: 46 },
  levels: { x: 490, y: 416, w: 300, h: 46 },
};

export const COMPLETE_BUTTONS = {
  next: { x: 370, y: 470, w: 180, h: 48 },
  retry: { x: 560, y: 470, w: 130, h: 48 },
  levels: { x: 700, y: 470, w: 180, h: 48 },
};

export const GAMECOMPLETE_BUTTONS = {
  again: { x: 430, y: 420, w: 200, h: 48 },
  levels: { x: 650, y: 420, w: 200, h: 48 },
};

export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function selectCardRect(index) {
  const col = index % 4;
  const row = Math.floor(index / 4);
  return { x: 60 + col * (272 + 24), y: 190 + row * (158 + 24), w: 272, h: 158 };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSheet(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, PALETTE.backdrop);
  gradient.addColorStop(1, PALETTE.backdropDeep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.gridMinor;
  ctx.beginPath();
  for (let x = 0; x <= FIELD.width; x += TILE) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, FIELD.height);
  }
  for (let y = ORIGIN_Y; y <= FIELD.height; y += TILE) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(FIELD.width, y + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = PALETTE.annotation;
  ctx.strokeRect(6.5, 6.5, FIELD.width - 13, FIELD.height - 13);
  ctx.strokeStyle = 'rgba(120, 180, 230, 0.25)';
  ctx.strokeRect(12.5, 12.5, FIELD.width - 25, FIELD.height - 25);
}

function drawButton(ctx, rect, label, { primary = false, selected = false } = {}) {
  ctx.fillStyle = primary ? 'rgba(255, 201, 77, 0.14)' : 'rgba(6, 20, 38, 0.85)';
  ctx.strokeStyle = primary || selected ? PALETTE.gold : PALETTE.panelEdge;
  ctx.lineWidth = primary || selected ? 2.5 : 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = primary ? PALETTE.gold : PALETTE.text;
  ctx.font = `700 17px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawStar(ctx, x, y, radius, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fill();
    ctx.strokeStyle = PALETTE.goldDeep;
  } else {
    ctx.strokeStyle = PALETTE.dim;
  }
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPanel(ctx, rect) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.fill();
  ctx.stroke();
}

function drawTitleSketch(ctx, time) {
  // A cross-section of the idea: one surveyor on the floor, one on the
  // ceiling, a portal waiting, and the dimension lines of a drawing.
  ctx.strokeStyle = 'rgba(234, 244, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(120, 560, 300, 26);
  ctx.strokeRect(860, 560, 300, 26);
  ctx.strokeRect(480, 96, 320, 26);
  ctx.fillStyle = 'rgba(14, 58, 104, 0.6)';
  ctx.fillRect(120, 560, 300, 26);
  ctx.fillRect(860, 560, 300, 26);
  ctx.fillRect(480, 96, 320, 26);
  drawSurveyor(ctx, 270, 546, { face: 1, gravity: 1, runPhase: time * 120, moving: true, grounded: true, time });
  drawSurveyor(ctx, 640, 136, { face: -1, gravity: -1, runPhase: time * 120, moving: true, grounded: true, time });
  // Portal sketch.
  ctx.save();
  ctx.translate(1010, 500);
  ctx.strokeStyle = PALETTE.gold;
  ctx.setLineDash([8, 6]);
  ctx.lineDashOffset = -time * 24;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Dimension line with arrows, labelling the flip.
  ctx.strokeStyle = PALETTE.annotation;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1160, 130);
  ctx.lineTo(1160, 552);
  ctx.moveTo(1152, 140);
  ctx.lineTo(1160, 130);
  ctx.lineTo(1168, 140);
  ctx.moveTo(1152, 542);
  ctx.lineTo(1160, 552);
  ctx.lineTo(1168, 542);
  ctx.stroke();
  ctx.fillStyle = PALETTE.annotation;
  ctx.font = `12px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('GRAVITY', 1160, 330);
  ctx.fillText('REVERSIBLE', 1160, 348);
  // A floating shard.
  ctx.save();
  ctx.translate(180, 200 + Math.sin(time * 2) * 4);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.gold;
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
}

export function drawTitle(ctx, progress, time) {
  drawSheet(ctx);
  drawTitleSketch(ctx, time);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 96px ${FONT_UI}`;
  try {
    ctx.letterSpacing = '14px';
  } catch {
    // Older canvas implementations ignore letter spacing; the title still reads.
  }
  ctx.fillText('FALLSIDE', FIELD.width / 2, 248);
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // No-op fallback.
  }
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(430, 300);
  ctx.lineTo(850, 300);
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 28px ${FONT_UI}`;
  try {
    ctx.letterSpacing = '8px';
  } catch {
    // No-op fallback.
  }
  ctx.fillText('FLIP THE FALL', FIELD.width / 2, 330);
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // No-op fallback.
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `17px ${FONT_UI}`;
  ctx.fillText('A blueprint gravity puzzle — the ceiling is also a floor.', FIELD.width / 2, 366);

  // Controls panel.
  drawPanel(ctx, { x: 390, y: 392, w: 500, h: 66 });
  ctx.font = `14px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  const controls = [
    ['A / D', 'RUN'],
    ['SPACE', 'JUMP'],
    ['F', 'FLIP'],
    ['P', 'PAUSE'],
    ['R', 'RESTART'],
    ['M', 'MUTE'],
  ];
  controls.forEach(([key, label], i) => {
    const x = 414 + (i % 3) * 166;
    const y = 416 + Math.floor(i / 3) * 26;
    ctx.fillStyle = PALETTE.cyan;
    ctx.fillText(key, x, y);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(label, x + 64, y);
  });

  // Best progress, or the first-run greeting.
  const totalStars = Object.values(progress.stars).reduce((sum, n) => sum + n, 0);
  const cleared = Object.keys(progress.stars).length;
  ctx.textAlign = 'center';
  ctx.font = `700 16px ${FONT_UI}`;
  if (cleared > 0) {
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`★ ${totalStars} / 24  ·  ${cleared} SHEET${cleared === 1 ? '' : 'S'} CLEARED`, FIELD.width / 2, 484);
  } else {
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('NO SHEETS CLEARED YET — GOOD LUCK, SURVEYOR', FIELD.width / 2, 484);
  }

  drawButton(ctx, TITLE_BUTTONS.start, 'START', { primary: true });
  drawButton(ctx, TITLE_BUTTONS.levels, 'LEVEL SELECT');
  const pulse = 0.55 + Math.sin(time * 2.4) * 0.3;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT_MONO}`;
  ctx.fillText('OR PRESS ENTER', FIELD.width / 2, 646);
  ctx.globalAlpha = 1;
}

export function drawLevelSelect(ctx, progress, selected, time) {
  drawSheet(ctx);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 46px ${FONT_UI}`;
  ctx.fillText('SELECT SHEET', FIELD.width / 2, 108);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT_MONO}`;
  ctx.fillText('ARROWS + ENTER, OR CLICK · ESC BACK', FIELD.width / 2, 148);

  LEVELS.forEach((level, i) => {
    const rect = selectCardRect(i);
    const unlocked = i < progress.unlocked;
    const stars = progress.stars[i] || 0;
    ctx.fillStyle = unlocked ? 'rgba(6, 20, 38, 0.85)' : 'rgba(6, 20, 38, 0.55)';
    ctx.strokeStyle = i === selected ? PALETTE.gold : PALETTE.panelEdge;
    ctx.lineWidth = i === selected ? 3 : 2;
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = unlocked ? PALETTE.dim : 'rgba(93, 125, 158, 0.5)';
    ctx.font = `800 44px ${FONT_UI}`;
    ctx.fillText(String(i + 1).padStart(2, '0'), rect.x + 18, rect.y + 46);
    ctx.fillStyle = unlocked ? PALETTE.text : PALETTE.dim;
    ctx.font = `700 17px ${FONT_UI}`;
    ctx.fillText(level.name, rect.x + 18, rect.y + 82);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `12px ${FONT_MONO}`;
    ctx.fillText(`PAR ${formatTime(level.par)}`, rect.x + 18, rect.y + 106);
    for (let s = 0; s < 3; s += 1) {
      drawStar(ctx, rect.x + 30 + s * 30, rect.y + 132, 11, unlocked && s < stars);
    }
    if (!unlocked) {
      ctx.strokeStyle = PALETTE.dim;
      ctx.lineWidth = 2.5;
      const lx = rect.x + rect.w - 46;
      const ly = rect.y + 26;
      ctx.beginPath();
      ctx.arc(lx, ly, 10, Math.PI, 0);
      ctx.stroke();
      roundRect(ctx, lx - 13, ly, 26, 20, 4);
      ctx.stroke();
      ctx.fillStyle = PALETTE.dim;
      ctx.font = `12px ${FONT_MONO}`;
      ctx.textAlign = 'right';
      ctx.fillText('LOCKED', rect.x + rect.w - 18, rect.y + 66);
    }
  });
  void time;
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(4, 12, 24, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawPanel(ctx, { x: 440, y: 190, w: 400, h: 340 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 44px ${FONT_UI}`;
  ctx.fillText('PAUSED', FIELD.width / 2, 252);
  drawButton(ctx, PAUSE_BUTTONS.resume, 'RESUME', { primary: true });
  drawButton(ctx, PAUSE_BUTTONS.restart, 'RESTART LEVEL');
  drawButton(ctx, PAUSE_BUTTONS.levels, 'LEVEL SELECT');
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT_MONO}`;
  ctx.fillText('F FLIP · SPACE JUMP · M MUTE', FIELD.width / 2, 498);
}

export function drawComplete(ctx, world, stars, isLast, panelTime) {
  ctx.fillStyle = 'rgba(4, 12, 24, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawPanel(ctx, { x: 340, y: 130, w: 600, h: 460 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 40px ${FONT_UI}`;
  ctx.fillText('SHEET COMPLETE', FIELD.width / 2, 196);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 18px ${FONT_UI}`;
  ctx.fillText(`${world.index + 1} · ${world.def.name}`, FIELD.width / 2, 234);

  for (let s = 0; s < 3; s += 1) {
    const local = panelTime - 0.15 * s;
    const scale = local <= 0 ? 0.2 : Math.min(1, local * 3);
    const filled = s < stars;
    ctx.save();
    ctx.translate(540 + s * 100, 310);
    ctx.scale(scale, scale);
    drawStar(ctx, 0, 0, 34, filled);
    ctx.restore();
  }

  const rows = [
    ['TIME', `${formatTime(world.completeTime)}  ·  PAR ${formatTime(world.def.par)}`],
    ['SHARDS', `${world.shardsTaken} / ${world.shards.length}`],
    ['DEATHS', String(world.deaths)],
  ];
  ctx.font = `16px ${FONT_UI}`;
  rows.forEach(([label, value], i) => {
    const y = 392 + i * 30;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(label, 590, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(value, 620, y);
  });

  drawButton(ctx, COMPLETE_BUTTONS.next, isLast ? 'FINISH' : 'NEXT SHEET', { primary: true });
  drawButton(ctx, COMPLETE_BUTTONS.retry, 'RETRY');
  drawButton(ctx, COMPLETE_BUTTONS.levels, 'LEVELS');
}

export function drawGameComplete(ctx, totals) {
  ctx.fillStyle = 'rgba(4, 12, 24, 0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawSheet(ctx);
  ctx.fillStyle = 'rgba(4, 12, 24, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  drawPanel(ctx, { x: 340, y: 150, w: 600, h: 420 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 40px ${FONT_UI}`;
  ctx.fillText('BLUEPRINT COMPLETE', FIELD.width / 2, 216);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = `700 18px ${FONT_UI}`;
  ctx.fillText('ALL 8 SHEETS CLEARED — THE FALL IS YOURS', FIELD.width / 2, 254);
  for (let s = 0; s < 3; s += 1) {
    drawStar(ctx, 590 + s * 50, 310, 18, true);
  }
  const rows = [
    ['STARS', `${totals.stars} / 24`],
    ['TOTAL TIME', formatTime(totals.time)],
    ['TOTAL DEATHS', String(totals.deaths)],
  ];
  ctx.font = `16px ${FONT_UI}`;
  rows.forEach(([label, value], i) => {
    const y = 352 + i * 30;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(label, 590, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(value, 620, y);
  });
  drawButton(ctx, GAMECOMPLETE_BUTTONS.again, 'PLAY AGAIN', { primary: true });
  drawButton(ctx, GAMECOMPLETE_BUTTONS.levels, 'LEVEL SELECT');
}
