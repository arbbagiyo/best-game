// Everything on screen, drawn as blueprint line art: a deep-blue sheet with
// a faint grid, white and cyan outlines, gold for what matters (shards, key,
// exit), coral only for what kills. The static layer (grid, blocks, spikes)
// is pre-rendered once per level; the moving pieces are drawn every frame.

import { FIELD, TILE, ORIGIN_Y, COLS, ROWS, BUTTONS, PALETTE, PLAYER, FONT_UI, FONT_MONO, WORLD } from './config.js';

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
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

/** The static sheet: background, grid, blocks, spikes, frame, annotations. */
export function createBackdrop(world) {
  const canvas = document.createElement('canvas');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const ctx = canvas.getContext('2d');

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
  ctx.strokeStyle = PALETTE.gridMajor;
  ctx.beginPath();
  for (let x = 0; x <= FIELD.width; x += TILE * 5) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, FIELD.height);
  }
  for (let y = ORIGIN_Y; y <= FIELD.height; y += TILE * 5) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(FIELD.width, y + 0.5);
  }
  ctx.stroke();

  // Faint background schematics so open rooms never read as empty: dashed
  // machine circles, a diagonal brace and registration crosses. They sit
  // behind everything and never suggest a solid surface.
  ctx.strokeStyle = 'rgba(120, 180, 230, 0.16)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(320, 300, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(980, 250, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(150, 470);
  ctx.lineTo(430, 190);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(120, 180, 230, 0.22)';
  for (let x = 160; x < FIELD.width; x += 320) {
    for (let y = 168; y < FIELD.height - 80; y += 224) {
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }

  // Solid blocks, with a bright top edge where the surface is exposed.
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      if (world.grid[ty][tx] !== '#') continue;
      const x = tx * TILE;
      const y = ORIGIN_Y + ty * TILE;
      ctx.fillStyle = '#14477d';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(234, 244, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      const above = ty === 0 ? '#' : world.grid[ty - 1][tx];
      if (above !== '#') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + TILE, y + 1);
        ctx.stroke();
      }
      if ((tx + ty) % 3 === 0) {
        ctx.strokeStyle = 'rgba(234, 244, 255, 0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + TILE - 4);
        ctx.lineTo(x + TILE - 4, y + 4);
        ctx.stroke();
      }
    }
  }

  // Spikes: two coral teeth per tile, pointing with the tile's direction.
  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const ch = world.grid[ty][tx];
      if (ch !== '^' && ch !== 'v') continue;
      const x = tx * TILE;
      const y = ORIGIN_Y + ty * TILE;
      for (let k = 0; k < 2; k += 1) {
        const x0 = x + k * 16;
        ctx.beginPath();
        if (ch === '^') {
          ctx.moveTo(x0 + 1, y + TILE);
          ctx.lineTo(x0 + 8, y + 5);
          ctx.lineTo(x0 + 15, y + TILE);
        } else {
          ctx.moveTo(x0 + 1, y);
          ctx.lineTo(x0 + 8, y + TILE - 5);
          ctx.lineTo(x0 + 15, y);
        }
        ctx.closePath();
        ctx.fillStyle = PALETTE.hazardDeep;
        ctx.fill();
        ctx.strokeStyle = PALETTE.line;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  // The sheet frame and its drafting annotations.
  ctx.strokeStyle = PALETTE.annotation;
  ctx.lineWidth = 1;
  ctx.strokeRect(6.5, 6.5, FIELD.width - 13, FIELD.height - 13);
  ctx.strokeStyle = 'rgba(120, 180, 230, 0.25)';
  ctx.strokeRect(12.5, 12.5, FIELD.width - 25, FIELD.height - 25);
  ctx.fillStyle = PALETTE.annotation;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`FALLSIDE · SHEET 0${world.index + 1}`, 20, 26);
  ctx.textAlign = 'right';
  ctx.fillText('SCALE 1:32', FIELD.width - 20, 26);
  ctx.fillText('GRAVITY REVERSIBLE', FIELD.width - 20, FIELD.height - 18);
  ctx.textAlign = 'left';
  ctx.fillText(world.def.name, 20, FIELD.height - 18);

  return canvas;
}

/**
 * The surveyor, drawn centred at (x, y) facing right before the face flip.
 * flipProgress 0..1 squashes the sprite through flat as gravity reverses.
 * scale enlarges the DRAWN sprite only (the hitbox never changes): the live
 * player is drawn 1.5x so it reads at small sizes, while title-screen
 * illustrations keep scale 1.
 */
export function drawSurveyor(ctx, x, y, opts) {
  const { face = 1, gravity = 1, flipProgress = null, runPhase = 0, moving = false, grounded = true, time = 0, alpha = 1, scale = 1 } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  const scaleY = flipProgress === null ? gravity : gravity * (2 * flipProgress - 1);
  ctx.scale(face * scale, scaleY * scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2;

  // Legs: scissor when running, tucked when airborne.
  const swing = moving && grounded ? Math.sin(runPhase * 0.45) * 3 : 0;
  ctx.strokeStyle = PALETTE.suitShade;
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.lineTo(-4 + swing, 14);
  ctx.moveTo(4, 8);
  ctx.lineTo(4 - swing, 14);
  ctx.stroke();

  // Backpack (gold) sits behind the body.
  ctx.fillStyle = PALETTE.pack;
  ctx.strokeStyle = PALETTE.goldDeep;
  roundRect(ctx, -14, -8, 6, 13, 2);
  ctx.fill();
  ctx.stroke();

  // Body: white suit, cyan seams.
  ctx.fillStyle = PALETTE.suit;
  ctx.strokeStyle = PALETTE.cyanDim;
  roundRect(ctx, -10, -11, 20, 20, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.cyan;
  ctx.beginPath();
  ctx.arc(0, 2, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Helmet dome and visor.
  ctx.fillStyle = PALETTE.suitShade;
  ctx.strokeStyle = PALETTE.cyanDim;
  ctx.beginPath();
  ctx.arc(0, -11, 9, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.visor;
  roundRect(ctx, 0, -13, 8, 6, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(5, -12, 2, 2);

  // Antenna with a blinking tip.
  ctx.strokeStyle = PALETTE.suitShade;
  ctx.beginPath();
  ctx.moveTo(-3, -19);
  ctx.lineTo(-3, -24);
  ctx.stroke();
  ctx.fillStyle = Math.sin(time * 4) > 0 ? PALETTE.gold : PALETTE.goldDeep;
  ctx.beginPath();
  ctx.arc(-3, -25, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawMover(ctx, mover, time) {
  // The dotted path the platform travels.
  ctx.strokeStyle = 'rgba(53, 208, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  if (mover.axis === 'x') {
    ctx.moveTo(mover.baseX - mover.range + mover.w / 2, mover.baseY + mover.h / 2);
    ctx.lineTo(mover.baseX + mover.range + mover.w / 2, mover.baseY + mover.h / 2);
  } else {
    ctx.moveTo(mover.baseX + mover.w / 2, mover.baseY - mover.range + mover.h / 2);
    ctx.lineTo(mover.baseX + mover.w / 2, mover.baseY + mover.range + mover.h / 2);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#123f6e';
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  roundRect(ctx, mover.x, mover.y, mover.w, mover.h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(mover.x + 4, mover.y + 1.5);
  ctx.lineTo(mover.x + mover.w - 4, mover.y + 1.5);
  ctx.stroke();
  // Chevrons pointing along the travel axis.
  ctx.strokeStyle = PALETTE.cyan;
  ctx.lineWidth = 2;
  const cx = mover.x + mover.w / 2;
  const cy = mover.y + mover.h / 2;
  ctx.beginPath();
  if (mover.axis === 'x') {
    ctx.moveTo(cx - 10, cy - 4);
    ctx.lineTo(cx - 4, cy);
    ctx.lineTo(cx - 10, cy + 4);
    ctx.moveTo(cx + 4, cy - 4);
    ctx.lineTo(cx + 10, cy);
    ctx.lineTo(cx + 4, cy + 4);
  } else {
    ctx.moveTo(cx - 4, cy - 10);
    ctx.lineTo(cx, cy - 4);
    ctx.lineTo(cx + 4, cy - 10);
    ctx.moveTo(cx - 4, cy + 4);
    ctx.lineTo(cx, cy + 10);
    ctx.lineTo(cx + 4, cy + 4);
  }
  ctx.stroke();
}

function drawSaw(ctx, saw) {
  ctx.save();
  ctx.translate(saw.x, saw.y);
  ctx.rotate(saw.angle);
  ctx.beginPath();
  const teeth = 12;
  for (let i = 0; i < teeth * 2; i += 1) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? WORLD.sawRadius : WORLD.sawRadius - 5;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#dfe9f5';
  ctx.fill();
  ctx.strokeStyle = PALETTE.lineDim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.hazard;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShard(ctx, shard, index, time) {
  const bob = Math.sin(time * 2 + index * 1.7) * 3;
  const spin = Math.cos(time * 2.6 + index * 1.3);
  ctx.save();
  ctx.translate(shard.x, shard.y + bob);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.scale(Math.max(0.25, Math.abs(spin)), 1);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.gold;
  ctx.strokeStyle = PALETTE.goldDeep;
  ctx.lineWidth = 2;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(-4, -4, 4, 4);
  ctx.restore();
}

function drawKey(ctx, key, time) {
  const bob = Math.sin(time * 2.2) * 3;
  ctx.save();
  ctx.translate(key.x, key.y + bob);
  ctx.rotate(Math.sin(time * 1.4) * 0.15);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-6, 0, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(13, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(8, 6);
  ctx.moveTo(13, 0);
  ctx.lineTo(13, 6);
  ctx.stroke();
  ctx.restore();
}

function drawPortal(ctx, exit, time) {
  const pulse = 1 + Math.sin(time * 2.4) * 0.05;
  ctx.save();
  ctx.translate(exit.x, exit.y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  glow.addColorStop(0, 'rgba(255, 201, 77, 0.5)');
  glow.addColorStop(1, 'rgba(255, 201, 77, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 7]);
  ctx.lineDashOffset = -time * 28;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineDashOffset = time * 36;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(0, 0, 8 + Math.sin(time * 3.1) * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCheckpoint(ctx, checkpoint, time) {
  const x = checkpoint.x;
  const baseY = checkpoint.y;
  ctx.strokeStyle = checkpoint.active ? PALETTE.cyan : PALETTE.dim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 44);
  ctx.stroke();
  const wave = Math.sin(time * 3) * 3;
  ctx.beginPath();
  ctx.moveTo(x, baseY - 44);
  ctx.lineTo(x + 22, baseY - 38 + wave * 0.4);
  ctx.lineTo(x, baseY - 31);
  ctx.closePath();
  if (checkpoint.active) {
    ctx.fillStyle = PALETTE.cyan;
    ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath();
    ctx.arc(x, baseY - 24, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = PALETTE.dim;
    ctx.stroke();
  }
}

function drawDoor(ctx, world) {
  if (world.doorCells.length === 0 || world.doorAnim >= 1) return;
  const xs = world.doorCells.map((c) => c.tx);
  const ys = world.doorCells.map((c) => c.ty);
  const minX = Math.min(...xs) * TILE;
  const minY = ORIGIN_Y + Math.min(...ys) * TILE;
  const height = (Math.max(...ys) - Math.min(...ys) + 1) * TILE;
  const slide = world.doorAnim * height;
  ctx.save();
  ctx.globalAlpha = 1 - world.doorAnim * 0.6;
  ctx.translate(0, -slide);
  ctx.fillStyle = 'rgba(20, 50, 90, 0.92)';
  ctx.fillRect(minX, minY, TILE, height);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(minX + 1, minY + 1, TILE - 2, height - 2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < 4; i += 1) {
    const bx = minX + (i * TILE) / 4;
    ctx.moveTo(bx, minY + 3);
    ctx.lineTo(bx, minY + height - 3);
  }
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath();
  ctx.arc(minX + TILE / 2, minY + height / 2, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrumbles(ctx, world, time) {
  for (const crumble of world.crumbles.values()) {
    if (crumble.state === 'gone') continue;
    const x = crumble.tx * TILE;
    const y = ORIGIN_Y + crumble.ty * TILE + (crumble.state === 'falling' ? crumble.fall : 0);
    const jitter = crumble.state === 'shaking' ? Math.sin(time * 60) * 1.5 : 0;
    ctx.save();
    ctx.translate(jitter, 0);
    if (crumble.state === 'falling') ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#0e3a68';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(234, 244, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(x + 7, y + 6);
    ctx.lineTo(x + 14, y + 14);
    ctx.lineTo(x + 10, y + 24);
    ctx.moveTo(x + 22, y + 8);
    ctx.lineTo(x + 18, y + 18);
    ctx.stroke();
    ctx.restore();
  }
}

// The live player is drawn larger than its hitbox so it reads at small
// sizes; the lift keeps the drawn feet planted on the surface the hitbox
// stands on, in either gravity direction.
const PLAYER_DRAW_SCALE = 1.5;
const PLAYER_DRAW_LIFT = (PLAYER_DRAW_SCALE - 1) * (PLAYER.height / 2);

/** The live level: backdrop, moving pieces, player, particles. */
export function drawWorld(ctx, world, backdrop, particles, time) {
  ctx.drawImage(backdrop, 0, 0);
  for (const mover of world.movers) drawMover(ctx, mover, time);
  drawCrumbles(ctx, world, time);
  drawDoor(ctx, world);
  for (const checkpoint of world.checkpoints) drawCheckpoint(ctx, checkpoint, time);
  world.shards.forEach((shard, i) => {
    if (!shard.taken) drawShard(ctx, shard, i, time);
  });
  if (world.key && !world.key.taken) drawKey(ctx, world.key, time);
  drawPortal(ctx, world.exit, time);
  for (const saw of world.saws) drawSaw(ctx, saw);

  const player = world.player;
  if (!player.dead) {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2 - player.gravity * PLAYER_DRAW_LIFT;
    if (player.flipAnim > 0) {
      // Expanding flip rings: the flip must read as THE action, not a flicker.
      const progress = 1 - player.flipAnim / PLAYER.flipAnimTime;
      const ringR = 26 + progress * 52;
      ctx.save();
      ctx.globalAlpha = 0.9 * (1 - progress * 0.45);
      ctx.strokeStyle = PALETTE.cyan;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.55 * (1 - progress * 0.45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(10, ringR - 16), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      world.trail.forEach((ghost, i) => {
        if (i === 0) return;
        drawSurveyor(ctx, ghost.x + player.w / 2, ghost.y + player.h / 2 - ghost.gravity * PLAYER_DRAW_LIFT, {
          face: player.face,
          gravity: ghost.gravity,
          flipProgress: ghost.flipAnim > 0 ? 1 - ghost.flipAnim / PLAYER.flipAnimTime : null,
          time,
          alpha: 0.3 * (1 - i / world.trail.length),
          scale: PLAYER_DRAW_SCALE,
        });
      });
    }
    drawSurveyor(ctx, cx, cy, {
      face: player.face,
      gravity: player.gravity,
      flipProgress: player.flipAnim > 0 ? 1 - player.flipAnim / PLAYER.flipAnimTime : null,
      runPhase: player.runPhase,
      moving: Math.abs(player.vx) > 20,
      grounded: player.grounded,
      time,
      scale: PLAYER_DRAW_SCALE,
    });
  }
  particles.draw(ctx);
}

function drawRoundButton(ctx, rect, label, sublabel, opts = {}) {
  ctx.fillStyle = opts.fill || 'rgba(6, 20, 38, 0.8)';
  ctx.strokeStyle = opts.edge || PALETTE.panelEdge;
  ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = opts.text || PALETTE.text;
  ctx.font = `700 ${opts.size || 15}px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + (sublabel ? -6 : 0));
  if (sublabel) {
    ctx.font = `11px ${FONT_MONO}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(sublabel, rect.x + rect.w / 2, rect.y + rect.h / 2 + 12);
  }
}

function drawCircleButton(ctx, circle, glyph, label, opts = {}) {
  ctx.fillStyle = opts.fill || 'rgba(6, 20, 38, 0.82)';
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = opts.edge || PALETTE.cyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(circle.x, circle.y, circle.r - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = opts.text || PALETTE.text;
  ctx.font = `700 30px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, circle.x, circle.y - 8);
  ctx.font = `700 12px ${FONT_UI}`;
  ctx.fillText(label, circle.x, circle.y + 20);
}

/** The HUD band, the flip/jump buttons, and the level hint. */
export function drawHUD(ctx, world, { muted, time }) {
  ctx.fillStyle = 'rgba(6, 20, 38, 0.78)';
  ctx.fillRect(0, 0, FIELD.width, 44);
  ctx.strokeStyle = 'rgba(53, 208, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 44.5);
  ctx.lineTo(FIELD.width, 44.5);
  ctx.stroke();

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 17px ${FONT_UI}`;
  ctx.fillText(`LEVEL ${world.index + 1} · ${world.def.name}`, 16, 23);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT_MONO}`;
  ctx.fillText(`PAR ${formatTime(world.def.par)}`, 16, 39);

  // Centre cluster: shards, timer, deaths.
  const pop = 1 + Math.max(0, world.shardPop) * 1.6;
  ctx.save();
  ctx.translate(560, 23);
  ctx.scale(pop, pop);
  ctx.fillStyle = PALETTE.gold;
  ctx.save();
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.font = `700 18px ${FONT_UI}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${world.shardsTaken}/${world.shards.length}`, 14, 0);
  ctx.restore();

  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 19px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(formatTime(world.time), 665, 23);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT_UI}`;
  ctx.textAlign = 'left';
  ctx.fillText(`DEATHS ${world.deaths}`, 740, 23);

  drawRoundButton(ctx, BUTTONS.mute, muted ? '✕♪' : '♪', null, { size: 16 });
  drawRoundButton(ctx, BUTTONS.restart, '↺', null, { size: 18 });
  drawRoundButton(ctx, BUTTONS.pause, '❚❚', null, { size: 14 });

  // The flip button shows its cooldown as a sweeping arc.
  const player = world.player;
  const ready = player.flipCooldown <= 0;
  const fraction = ready ? 1 : 1 - player.flipCooldown / PLAYER.flipCooldown;
  drawCircleButton(ctx, BUTTONS.flip, '⇅', 'FLIP', {
    edge: ready ? PALETTE.cyan : PALETTE.dim,
    text: ready ? PALETTE.text : PALETTE.muted,
  });
  if (!ready) {
    ctx.strokeStyle = PALETTE.cyan;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(BUTTONS.flip.x, BUTTONS.flip.y, BUTTONS.flip.r - 1.5, -Math.PI / 2, -Math.PI / 2 + fraction * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('F', BUTTONS.flip.x, BUTTONS.flip.y - BUTTONS.flip.r - 8);

  drawCircleButton(ctx, BUTTONS.jump, '▲', 'JUMP', { edge: PALETTE.panelEdge });
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `11px ${FONT_MONO}`;
  ctx.fillText('SPACE', BUTTONS.jump.x, BUTTONS.jump.y - BUTTONS.jump.r - 8);

  // The level hint fades out a few seconds in.
  if (world.time < 6 && !world.completed) {
    const alpha = Math.min(1, (6 - world.time) / 1.5) * 0.95;
    ctx.globalAlpha = alpha;
    ctx.font = `14px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    const width = ctx.measureText(world.def.hint).width + 36;
    ctx.fillStyle = 'rgba(6, 20, 38, 0.75)';
    roundRect(ctx, FIELD.width / 2 - width / 2, 668, width, 30, 15);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(world.def.hint, FIELD.width / 2, 684);
    ctx.globalAlpha = 1;
  }
}
