// One place that turns world events into sound and particles. The live game
// passes its audio object; screenshot staging passes null and gets the same
// particles, so staged frames show the same feedback a player sees.

import { PALETTE } from './config.js';

export function applyEvents(events, world, particles, random, audio) {
  const gravity = world.player.gravity;
  for (const event of events) {
    switch (event.type) {
      case 'jumped': {
        if (audio) audio.jump();
        const down = gravity > 0 ? Math.PI / 2 : -Math.PI / 2;
        particles.spray(event.x, event.y, down, random, { count: 7, speed: 150, color: PALETTE.lineDim });
        break;
      }
      case 'flipped': {
        if (audio) audio.flip();
        particles.ring(event.x, event.y, random, { count: 24, speed: 260, color: PALETTE.cyan });
        particles.burst(event.x, event.y, random, { count: 10, speed: 170, color: PALETTE.line, life: 0.4 });
        break;
      }
      case 'landed': {
        if (event.hard && audio) audio.land();
        const down = gravity > 0 ? Math.PI / 2 : -Math.PI / 2;
        particles.spray(event.x, event.y, down, random, { count: event.hard ? 8 : 4, speed: 110, color: PALETTE.lineDim });
        break;
      }
      case 'shard': {
        if (audio) audio.shard(event.step);
        particles.sparkle(event.x, event.y, random, PALETTE.gold);
        particles.text(event.x, event.y - 18, '◆', PALETTE.gold, 20);
        break;
      }
      case 'key': {
        if (audio) audio.key();
        particles.ring(event.x, event.y, random, { count: 22, speed: 220, color: PALETTE.gold });
        break;
      }
      case 'door': {
        if (audio) audio.door();
        break;
      }
      case 'checkpoint': {
        if (audio) audio.checkpoint();
        particles.sparkle(event.x, event.y, random, PALETTE.cyan);
        particles.text(event.x, event.y - 20, 'CHECKPOINT', PALETTE.cyan, 15);
        break;
      }
      case 'crumble': {
        particles.spray(event.x, event.y, Math.PI / 2, random, { count: 5, speed: 90, color: PALETTE.lineDim });
        break;
      }
      case 'died': {
        if (audio) audio.death();
        particles.burst(event.x, event.y, random, { count: 30, speed: 260, color: PALETTE.hazard, life: 0.6 });
        particles.burst(event.x, event.y, random, { count: 14, speed: 180, color: PALETTE.line, life: 0.5 });
        particles.addTrauma(0.55);
        break;
      }
      case 'respawned': {
        particles.ring(event.x, event.y, random, { count: 16, speed: 180, color: PALETTE.cyan });
        break;
      }
      case 'complete': {
        if (audio) audio.win();
        particles.ring(event.x, event.y, random, { count: 30, speed: 320, color: PALETTE.gold });
        particles.burst(event.x, event.y, random, { count: 22, speed: 240, color: PALETTE.gold, life: 0.7 });
        break;
      }
      default:
        break;
    }
  }
}
