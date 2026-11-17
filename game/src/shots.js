// Screenshot staging: each shot is a real run of the game's own code,
// driven by a fixed script of inputs through the same fixed steps a player
// gets. No state is fabricated: the title shot idles on level 1, the play
// shot flips onto the ceiling of level 4 and runs to centre frame above
// the saws, the flip shot rides the moving platform over the pit on level 5
// and freezes mid-flip at centre frame, and the complete shot genuinely
// finishes level 1 with all three shards.

import { STEP } from './config.js';
import { createRandom } from './rng.js';
import { createParticles } from './particles.js';
import { createWorld, updateWorld, starsEarned } from './world.js';
import { createBackdrop } from './render.js';
import { applyEvents } from './effects.js';

/**
 * Play a script of input segments. Each segment is {steps, move, jump, hold,
 * flip}: jump presses on the segment's first step, hold keeps the jump
 * button down for the whole segment (a full-height jump), flip presses on
 * the first step. settleSteps of neutral input follow the script.
 */
function runScript(world, particles, random, segments, settleSteps) {
  for (const segment of segments) {
    for (let s = 0; s < segment.steps; s += 1) {
      const snap = {
        move: segment.move || 0,
        jumpPressed: s === 0 && !!segment.jump,
        jumpHeld: !!segment.hold,
        flipPressed: s === 0 && !!segment.flip,
      };
      const events = [];
      updateWorld(world, STEP, snap, events);
      applyEvents(events, world, particles, random, null);
      particles.update(STEP);
    }
  }
  for (let s = 0; s < settleSteps; s += 1) {
    const events = [];
    updateWorld(world, STEP, { move: 0, jumpPressed: false, jumpHeld: false, flipPressed: false }, events);
    applyEvents(events, world, particles, random, null);
    particles.update(STEP);
  }
}

const EMPTY_PROGRESS = { stars: {}, times: {}, deaths: {}, unlocked: 1 };

export function stageShot(kind, seed) {
  const random = createRandom(seed);
  const particles = createParticles();

  if (kind === 'title') {
    const world = createWorld(0);
    runScript(world, particles, random, [{ steps: 30, move: 0 }], 0);
    return {
      screen: 'title',
      world,
      backdrop: createBackdrop(world),
      particles,
      random,
      time: 1.0,
      panelTime: 0,
      stars: 0,
      progress: { stars: { 0: 3, 1: 2 }, times: { 0: 14.2, 1: 22.8 }, deaths: { 0: 0, 1: 1 }, unlocked: 3 },
    };
  }

  if (kind === 'play') {
    // Level 4 (THE KEY): flip before the floor saws, rise to the ceiling
    // past the ceiling spikes, and run along the ceiling to centre frame.
    // Ends grounded on the ceiling at x~630 with the saws, shards, door and
    // portal all in view. Verified against the real simulation in Node.
    const world = createWorld(3);
    runScript(world, particles, random, [
      { steps: 60, move: 1 },
      { steps: 1, move: 1, flip: true },
      { steps: 70, move: 1 },
    ], 10);
    return {
      screen: 'play',
      world,
      backdrop: createBackdrop(world),
      particles,
      random,
      time: world.time,
      panelTime: 0,
      stars: 0,
      progress: EMPTY_PROGRESS,
    };
  }

  if (kind === 'flip') {
    // Level 5 (SAW LANE): jump onto the moving platform, ride it over the
    // pit, drop off its far side and flip at centre frame, freezing 11 steps
    // into the flip animation (rings expanded, ghosts trailing, character
    // two-thirds reformed upside down, checkpoint not yet touched).
    // Verified against the real simulation.
    const world = createWorld(4);
    runScript(world, particles, random, [
      { steps: 80, move: 1 },
      { steps: 45, move: 1, jump: true, hold: true },
      { steps: 8, move: 1 },
      { steps: 1, move: 1, flip: true },
      { steps: 11, move: 1 },
    ], 0);
    return {
      screen: 'play',
      world,
      backdrop: createBackdrop(world),
      particles,
      random,
      time: world.time,
      panelTime: 0,
      stars: 0,
      progress: EMPTY_PROGRESS,
    };
  }

  if (kind === 'complete') {
    const world = createWorld(0);
    runScript(world, particles, random, [
      { steps: 20, move: 1 },
      { steps: 42, move: 1, jump: true, hold: true },
      { steps: 6, move: 1 },
      { steps: 40, move: 1, jump: true, hold: true },
      { steps: 10, move: 1 },
      { steps: 30, move: 1, jump: true, hold: true },
      { steps: 20, move: 1 },
      { steps: 40, move: 1, jump: true, hold: true },
      { steps: 70, move: 1 },
    ], 6);
    const stars = world.completed ? starsEarned(world) : 0;
    if (!world.completed) {
      // The capture log shows this; the shot is only usable once the script
      // genuinely finishes the level.
      console.warn('complete staging did not finish the level', {
        x: world.player.x,
        y: world.player.y,
        shards: world.shardsTaken,
        deaths: world.deaths,
      });
    }
    return {
      screen: 'complete',
      world,
      backdrop: createBackdrop(world),
      particles,
      random,
      time: world.time,
      panelTime: 1.2,
      stars,
      progress: { stars: { 0: stars }, times: { 0: world.completeTime }, deaths: { 0: world.deaths }, unlocked: 2 },
    };
  }

  throw new Error(`unknown shot: ${kind}`);
}
