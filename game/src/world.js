// A running level: the parsed grid, the moving pieces, the timer, deaths and
// pickups, and every rule that turns player movement into events. The world
// is stepped at a fixed rate with a plain input snapshot, so the same script
// of inputs always plays the same run — staging and testing included.

import { COLS, ROWS, TILE, ORIGIN_Y, FIELD, WORLD } from './config.js';
import { LEVELS } from './levels.js';
import { createPlayer, resetPlayer, updatePlayer } from './player.js';

function cellCenter(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ORIGIN_Y + ty * TILE + TILE / 2 };
}

export function createWorld(levelIndex) {
  const def = LEVELS[levelIndex];
  const grid = def.rows.map((row) => row.split(''));
  const shards = [];
  const checkpoints = [];
  const doorCells = [];
  const saws = [];
  const crumbles = new Map();
  let spawn = { x: 48, y: 648 };
  let exit = { x: 1200, y: 632 };
  let key = null;

  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const ch = grid[ty][tx];
      const center = cellCenter(tx, ty);
      if (ch === 'S') spawn = { x: center.x, y: ORIGIN_Y + (ty + 1) * TILE };
      else if (ch === 'E') exit = center;
      else if (ch === '*') shards.push({ x: center.x, y: center.y, taken: false });
      else if (ch === 'k') key = { x: center.x, y: center.y, taken: false };
      else if (ch === 'D') doorCells.push({ tx, ty });
      else if (ch === 'C') checkpoints.push({ x: center.x, y: ORIGIN_Y + (ty + 1) * TILE, active: false });
      else if (ch === 'o') saws.push({ x: center.x, y: center.y, baseX: center.x, baseY: center.y, patrol: false, angle: 0 });
      else if (ch === 'c') crumbles.set(`${tx},${ty}`, { tx, ty, state: 'solid', timer: 0, fall: 0, fallV: 0 });
    }
  }
  for (const patrol of def.sawPatrols) {
    saws.push({ ...patrol, baseX: patrol.x, baseY: patrol.y, patrol: true, angle: 0 });
  }
  const movers = def.movers.map((m) => ({ ...m, baseX: m.x, baseY: m.y, dx: 0, dy: 0 }));

  const world = {
    index: levelIndex,
    def,
    grid,
    cols: COLS,
    rows: ROWS,
    player: null,
    spawn,
    respawn: { ...spawn },
    exit,
    shards,
    key,
    doorCells,
    checkpoints,
    crumbles,
    movers,
    saws,
    time: 0,
    deaths: 0,
    shardsTaken: 0,
    hasKey: false,
    doorOpen: false,
    doorAnim: 0,
    completed: false,
    completeTime: 0,
    respawnTimer: 0,
    shardPop: 0,
    trail: [],

    isSolid(tx, ty) {
      if (tx < 0 || tx >= this.cols) return true;
      if (ty < 0) return true;
      if (ty >= this.rows) return false;
      const ch = this.grid[ty][tx];
      if (ch === '#') return true;
      if (ch === 'D') return !this.doorOpen;
      if (ch === 'c') {
        const crumble = this.crumbles.get(`${tx},${ty}`);
        return crumble && (crumble.state === 'solid' || crumble.state === 'shaking');
      }
      return false;
    },
  };
  world.player = createPlayer(spawn);
  return world;
}

export function starsEarned(world) {
  let stars = 1;
  if (world.shardsTaken >= world.shards.length) stars += 1;
  if (world.completeTime <= world.def.par) stars += 1;
  return stars;
}

function die(world, events) {
  const player = world.player;
  player.dead = true;
  world.deaths += 1;
  world.respawnTimer = WORLD.respawnDelay;
  world.trail.length = 0;
  events.push({ type: 'died', x: player.x + player.w / 2, y: player.y + player.h / 2 });
}

function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** One fixed step. snap is {move, jumpPressed, jumpHeld, flipPressed}. */
export function updateWorld(world, dt, snap, events) {
  if (world.completed) {
    world.time += dt;
    updateMovers(world, dt);
    updateSaws(world, dt);
    return;
  }
  world.time += dt;
  if (world.shardPop > 0) world.shardPop -= dt;
  if (world.doorAnim < 1 && world.doorOpen) world.doorAnim = Math.min(1, world.doorAnim + dt * 2.4);

  updateMovers(world, dt);
  updateSaws(world, dt);
  updateCrumbles(world, dt);

  const player = world.player;
  if (player.dead) {
    world.respawnTimer -= dt;
    if (world.respawnTimer <= 0) {
      resetPlayer(player, world.respawn);
      events.push({ type: 'respawned', x: player.x + player.w / 2, y: player.y + player.h / 2 });
    }
    return;
  }

  updatePlayer(player, dt, snap, world, world.movers, events);

  // The flip trail: recent positions, drawn as ghosts mid-flip.
  world.trail.unshift({ x: player.x, y: player.y, gravity: player.gravity, flipAnim: player.flipAnim });
  if (world.trail.length > 10) world.trail.pop();

  const cx = player.x + player.w / 2;
  const cy = player.y + player.h / 2;

  // Falling out of the sheet is fatal, in either gravity direction.
  if (player.y > FIELD.height + 40 || player.y + player.h < -80) {
    die(world, events);
    return;
  }

  // Spikes: the teeth occupy a shrunken rect inside their tile.
  const shrink = 3;
  const left = Math.floor((player.x + shrink) / TILE);
  const right = Math.floor((player.x + player.w - shrink) / TILE);
  const top = Math.floor((player.y + shrink - ORIGIN_Y) / TILE);
  const bottom = Math.floor((player.y + player.h - shrink - ORIGIN_Y) / TILE);
  for (let ty = top; ty <= bottom; ty += 1) {
    for (let tx = left; tx <= right; tx += 1) {
      if (tx < 0 || tx >= world.cols || ty < 0 || ty >= world.rows) continue;
      const ch = world.grid[ty][tx];
      const tileTop = ORIGIN_Y + ty * TILE;
      if (ch === '^' && overlaps(player.x + shrink, player.y + shrink, player.w - shrink * 2, player.h - shrink * 2, tx * TILE + 5, tileTop + 17, TILE - 10, TILE - 17)) {
        die(world, events);
        return;
      }
      if (ch === 'v' && overlaps(player.x + shrink, player.y + shrink, player.w - shrink * 2, player.h - shrink * 2, tx * TILE + 5, tileTop, TILE - 10, 15)) {
        die(world, events);
        return;
      }
    }
  }

  // Saws: circle against the player's box.
  for (const saw of world.saws) {
    const nearestX = Math.max(player.x, Math.min(saw.x, player.x + player.w));
    const nearestY = Math.max(player.y, Math.min(saw.y, player.y + player.h));
    const dx = saw.x - nearestX;
    const dy = saw.y - nearestY;
    if (dx * dx + dy * dy < (WORLD.sawRadius - 3) * (WORLD.sawRadius - 3)) {
      die(world, events);
      return;
    }
  }

  // Standing on a crumble block starts its countdown.
  if (player.grounded) {
    const probeY = player.gravity > 0 ? player.y + player.h + 2 : player.y - 2;
    const tx = Math.floor(cx / TILE);
    const ty = Math.floor((probeY - ORIGIN_Y) / TILE);
    const crumble = world.crumbles.get(`${tx},${ty}`);
    if (crumble && crumble.state === 'solid') {
      crumble.state = 'shaking';
      crumble.timer = WORLD.crumbleDelay;
      events.push({ type: 'crumble', x: tx * TILE + TILE / 2, y: ORIGIN_Y + ty * TILE + TILE / 2 });
    }
  }

  // Pickups, checkpoints and the exit are generous circles around the centre.
  for (const shard of world.shards) {
    if (shard.taken) continue;
    const dx = shard.x - cx;
    const dy = shard.y - cy;
    if (dx * dx + dy * dy < 40 * 40) {
      shard.taken = true;
      world.shardsTaken += 1;
      world.shardPop = 0.25;
      events.push({ type: 'shard', x: shard.x, y: shard.y, step: world.shardsTaken });
    }
  }
  if (world.key && !world.key.taken) {
    const dx = world.key.x - cx;
    const dy = world.key.y - cy;
    if (dx * dx + dy * dy < 40 * 40) {
      world.key.taken = true;
      world.hasKey = true;
      world.doorOpen = true;
      world.doorAnim = 0;
      events.push({ type: 'key', x: world.key.x, y: world.key.y });
      events.push({ type: 'door', x: world.doorCells[0] ? world.doorCells[0].tx * TILE + TILE / 2 : cx, y: cy });
    }
  }
  for (const checkpoint of world.checkpoints) {
    if (checkpoint.active) continue;
    const flagY = checkpoint.y - 28;
    const dx = checkpoint.x - cx;
    const dy = flagY - cy;
    if (dx * dx + dy * dy < 40 * 40) {
      checkpoint.active = true;
      world.respawn = { x: checkpoint.x, y: checkpoint.y };
      events.push({ type: 'checkpoint', x: checkpoint.x, y: checkpoint.y - 24 });
    }
  }
  {
    // Generous on purpose: the portal's glow is ~44px, and a player who
    // jumps past it and lands against the far wall must still finish.
    const dx = world.exit.x - cx;
    const dy = world.exit.y - cy;
    if (dx * dx + dy * dy < 44 * 44) {
      world.completed = true;
      world.completeTime = world.time;
      events.push({ type: 'complete', x: world.exit.x, y: world.exit.y });
    }
  }
}

function updateMovers(world, dt) {
  for (const mover of world.movers) {
    const offset = Math.sin((world.time * Math.PI * 2) / mover.period + mover.phase) * mover.range;
    const nextX = mover.baseX + (mover.axis === 'x' ? offset : 0);
    const nextY = mover.baseY + (mover.axis === 'y' ? offset : 0);
    mover.dx = nextX - mover.x;
    mover.dy = nextY - mover.y;
    mover.x = nextX;
    mover.y = nextY;
  }
}

function updateSaws(world, dt) {
  for (const saw of world.saws) {
    saw.angle += dt * 6;
    if (saw.patrol) {
      const offset = Math.sin((world.time * Math.PI * 2) / saw.period + saw.phase) * saw.range;
      saw.x = saw.baseX + (saw.axis === 'x' ? offset : 0);
      saw.y = saw.baseY + (saw.axis === 'y' ? offset : 0);
    }
  }
}

function updateCrumbles(world, dt) {
  for (const crumble of world.crumbles.values()) {
    if (crumble.state === 'shaking') {
      crumble.timer -= dt;
      if (crumble.timer <= 0) {
        crumble.state = 'falling';
        crumble.fall = 0;
        crumble.fallV = 0;
      }
    } else if (crumble.state === 'falling') {
      crumble.fallV += 1400 * dt;
      crumble.fall += crumble.fallV * dt;
      if (crumble.fall > 240) {
        crumble.state = 'gone';
        crumble.timer = WORLD.crumbleRespawn;
      }
    } else if (crumble.state === 'gone') {
      crumble.timer -= dt;
      if (crumble.timer <= 0) crumble.state = 'solid';
    }
  }
}
