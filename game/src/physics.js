// Tile collision: axis-separated AABB movement against the level grid and
// the moving platforms, with gravity that can point down or up. The level
// object answers isSolid(tx, ty) for the grid (doors and crumble blocks
// included); movers are solid rectangles with a per-step delta, so standing
// on one carries the body along.

import { ORIGIN_Y, TILE } from './config.js';

export function tileAt(level, tx, ty) {
  if (tx < 0 || tx >= level.cols || ty < 0 || ty >= level.rows) return '#';
  return level.grid[ty][tx];
}

function overlapsRect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Move a body by (dx, dy) through the world. The body is {x, y, w, h} with
 * x/y its top-left corner in field coordinates. Returns what the move hit:
 * grounded (a floor in the gravity direction), headHit, wallHit, and the
 * mover the body stands on, if any.
 */
export function moveBody(level, movers, body, dx, dy, gravity) {
  const hit = { grounded: false, headHit: false, wallHit: false, mover: null };

  // Horizontal pass.
  body.x += dx;
  if (dx !== 0) {
    const top = Math.floor((body.y - ORIGIN_Y) / TILE);
    const bottom = Math.floor((body.y + body.h - 1 - ORIGIN_Y) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      const edgeX = dx > 0 ? body.x + body.w : body.x;
      const tx = Math.floor(edgeX / TILE);
      if (level.isSolid(tx, ty)) {
        if (dx > 0) body.x = tx * TILE - body.w - 0.01;
        else body.x = (tx + 1) * TILE + 0.01;
        hit.wallHit = true;
        break;
      }
    }
    for (const mover of movers) {
      if (overlapsRect(body.x, body.y, body.w, body.h, mover.x, mover.y, mover.w, mover.h)) {
        if (dx > 0) body.x = mover.x - body.w - 0.01;
        else body.x = mover.x + mover.w + 0.01;
        hit.wallHit = true;
      }
    }
  }

  // Vertical pass. The leading edge follows the movement direction; whether
  // the impact is a landing or a head bump follows the gravity direction.
  body.y += dy;
  if (dy !== 0) {
    const left = Math.floor(body.x / TILE);
    const right = Math.floor((body.x + body.w - 1) / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      const edgeY = dy > 0 ? body.y + body.h : body.y;
      const ty = Math.floor((edgeY - ORIGIN_Y) / TILE);
      if (level.isSolid(tx, ty)) {
        if (dy > 0) body.y = ty * TILE + ORIGIN_Y - body.h - 0.01;
        else body.y = (ty + 1) * TILE + ORIGIN_Y + 0.01;
        if (dy * gravity > 0) hit.grounded = true;
        else hit.headHit = true;
        break;
      }
    }
    for (const mover of movers) {
      if (overlapsRect(body.x, body.y, body.w, body.h, mover.x, mover.y, mover.w, mover.h)) {
        if (dy > 0) body.y = mover.y - body.h - 0.01;
        else body.y = mover.y + mover.h + 0.01;
        if (dy * gravity > 0) {
          hit.grounded = true;
          hit.mover = mover;
        } else {
          hit.headHit = true;
        }
      }
    }
  }

  // Standing still on a floor still counts as grounded (for coyote time and
  // for carrying): probe one pixel in the gravity direction.
  if (!hit.grounded) {
    const probeY = gravity > 0 ? body.y + body.h + 1 : body.y - 1;
    const left = Math.floor((body.x + 1) / TILE);
    const right = Math.floor((body.x + body.w - 2) / TILE);
    const ty = Math.floor((probeY - ORIGIN_Y) / TILE);
    for (let tx = left; tx <= right; tx += 1) {
      if (level.isSolid(tx, ty)) {
        hit.grounded = true;
        break;
      }
    }
    if (!hit.grounded) {
      for (const mover of movers) {
        const probe = gravity > 0
          ? overlapsRect(body.x, body.y + body.h, body.w, 2, mover.x, mover.y, mover.w, mover.h)
          : overlapsRect(body.x, body.y - 2, body.w, 2, mover.x, mover.y, mover.w, mover.h);
        if (probe) {
          hit.grounded = true;
          hit.mover = mover;
          break;
        }
      }
    }
  }
  return hit;
}
