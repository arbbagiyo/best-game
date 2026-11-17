// The surveyor: a small line-art robot whose run, jump and gravity flip are
// the whole game. Movement is tuned for feel: fast acceleration, coyote time
// after leaving a ledge, a buffered jump press, and a jump that shortens when
// the button is released early. Gravity points down (1) or up (-1) and the
// flip reverses it instantly, with a short cooldown.

import { PLAYER } from './config.js';
import { moveBody } from './physics.js';

export function createPlayer(spawn) {
  const player = {
    x: 0,
    y: 0,
    w: PLAYER.width,
    h: PLAYER.height,
    vx: 0,
    vy: 0,
    gravity: 1,
    face: 1,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    jumpCutDone: true,
    flipCooldown: 0,
    flipAnim: 0,
    dead: false,
    runPhase: 0,
    standingMover: null,
    wasGrounded: false,
  };
  resetPlayer(player, spawn);
  return player;
}

export function resetPlayer(player, spawn) {
  player.x = spawn.x - player.w / 2;
  player.y = spawn.y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.gravity = 1;
  player.face = 1;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.jumpCutDone = true;
  player.flipCooldown = 0;
  player.flipAnim = 0;
  player.dead = false;
  player.runPhase = 0;
  player.standingMover = null;
  player.wasGrounded = false;
}

/**
 * One fixed step. snap is {move, jumpPressed, jumpHeld, flipPressed}.
 * Events are pushed into the events array for the caller to sound and draw.
 */
export function updatePlayer(player, dt, snap, level, movers, events) {
  if (player.dead) return;

  if (player.flipCooldown > 0) player.flipCooldown -= dt;
  if (player.flipAnim > 0) player.flipAnim -= dt;

  // Gravity flip: instant, with a cooldown so it cannot be spammed.
  if (snap.flipPressed && player.flipCooldown <= 0) {
    player.gravity = -player.gravity;
    player.vy = 0;
    player.flipCooldown = PLAYER.flipCooldown;
    player.flipAnim = PLAYER.flipAnimTime;
    player.grounded = false;
    player.coyote = 0;
    events.push({ type: 'flipped', x: player.x + player.w / 2, y: player.y + player.h / 2 });
  }

  // Horizontal run: snappy on the ground, softer in the air.
  const target = snap.move * PLAYER.runSpeed;
  if (snap.move !== 0) {
    player.face = snap.move;
    const accel = player.grounded ? PLAYER.accel : PLAYER.airAccel;
    const step = accel * dt;
    player.vx += Math.max(-step, Math.min(step, target - player.vx));
  } else if (player.grounded) {
    const step = PLAYER.friction * dt;
    player.vx += Math.max(-step, Math.min(step, -player.vx));
  } else {
    const step = PLAYER.airAccel * 0.25 * dt;
    player.vx += Math.max(-step, Math.min(step, -player.vx));
  }

  // Jump: buffered presses, coyote time, variable height.
  if (snap.jumpPressed) player.jumpBuffer = PLAYER.jumpBuffer;
  else if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
  if (player.grounded) player.coyote = PLAYER.coyoteTime;
  else if (player.coyote > 0) player.coyote -= dt;

  if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -player.gravity * PLAYER.jumpVelocity;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.jumpCutDone = false;
    events.push({ type: 'jumped', x: player.x + player.w / 2, y: player.y + player.h / 2 });
  }
  const rising = player.vy * player.gravity < 0;
  if (!snap.jumpHeld && rising && !player.jumpCutDone) {
    player.vy *= PLAYER.jumpCut;
    player.jumpCutDone = true;
  }

  // Gravity, capped at terminal velocity.
  player.vy += player.gravity * PLAYER.gravity * dt;
  if (player.vy > PLAYER.maxFall) player.vy = PLAYER.maxFall;
  if (player.vy < -PLAYER.maxFall) player.vy = -PLAYER.maxFall;

  const fallSpeed = Math.abs(player.vy);
  const wasGrounded = player.grounded;
  const hit = moveBody(level, movers, player, player.vx * dt, player.vy * dt, player.gravity);
  player.grounded = hit.grounded;
  player.standingMover = hit.mover;
  if (hit.grounded || hit.headHit) player.vy = 0;

  // A moving platform carries its passenger.
  if (hit.mover) {
    player.x += hit.mover.dx;
    player.y += hit.mover.dy;
  }

  if (hit.grounded && !wasGrounded && fallSpeed > 200) {
    events.push({
      type: 'landed',
      x: player.x + player.w / 2,
      y: player.gravity > 0 ? player.y + player.h : player.y,
      hard: fallSpeed > 460,
    });
  }

  if (player.grounded && Math.abs(player.vx) > 20) {
    player.runPhase += Math.abs(player.vx) * dt;
  }
}
