// Particles, floating damage numbers, drifting embers and screen shake: all
// the feedback that makes every action feel answered. Particles are pooled
// (nothing allocates mid-fight) and every random choice goes through the
// world's seeded stream, so staged screenshots are repeatable.

export function createParticles(capacity = 600) {
  const pool = [];
  for (let i = 0; i < capacity; i += 1) {
    pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 0, gravity: 0, glow: false });
  }
  const texts = [];
  let trauma = 0;

  function spawn(x, y, vx, vy, life, size, color, options = {}) {
    for (let i = 0; i < pool.length; i += 1) {
      const p = pool[i];
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.life = life;
      p.maxLife = life;
      p.size = size;
      p.color = color;
      p.drag = options.drag ?? 2.2;
      p.gravity = options.gravity ?? 0;
      p.glow = options.glow ?? false;
      return;
    }
  }

  return {
    burst(x, y, random, { count = 10, speed = 160, life = 0.5, size = 3, color = '#ffb347', glow = true, gravity = 0 } = {}) {
      for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const velocity = speed * (0.35 + random() * 0.85);
        spawn(
          x, y,
          Math.cos(angle) * velocity, Math.sin(angle) * velocity,
          life * (0.6 + random() * 0.7), size * (0.6 + random() * 0.8), color,
          { glow, gravity },
        );
      }
    },
    spray(x, y, angle, random, { count = 6, speed = 220, spread = 0.5, life = 0.3, size = 2.5, color = '#ffd166' } = {}) {
      for (let i = 0; i < count; i += 1) {
        const a = angle + (random() - 0.5) * 2 * spread;
        const velocity = speed * (0.5 + random() * 0.8);
        spawn(x, y, Math.cos(a) * velocity, Math.sin(a) * velocity, life * (0.6 + random() * 0.8), size, color, { glow: true });
      }
    },
    ember(x, y, random, color = '#ff8c42') {
      spawn(x, y, (random() - 0.5) * 14, -18 - random() * 30, 1.4 + random() * 1.6, 1.5 + random() * 2, color, { drag: 0.2, glow: true });
    },
    sparkle(x, y, random, color = '#7dd3fc') {
      for (let i = 0; i < 5; i += 1) {
        const angle = random() * Math.PI * 2;
        spawn(x, y, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.35, 2, color, { glow: true });
      }
    },
    ring(x, y, random, { count = 26, speed = 300, color = '#ffd166', size = 3 } = {}) {
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 + random() * 0.1;
        spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.45, size, color, { drag: 3.2, glow: true });
      }
    },
    text(x, y, value, color = '#ffe9b0', size = 17) {
      texts.push({ x, y, life: 0.8, maxLife: 0.8, value: String(value), color, size });
      if (texts.length > 40) texts.shift();
    },
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    /** The current shake offset; decays every call. Drawn through the seeded stream. */
    shakeOffset(dt, random) {
      trauma = Math.max(0, trauma - dt * 1.6);
      const magnitude = trauma * trauma * 14;
      return { x: (random() * 2 - 1) * magnitude, y: (random() * 2 - 1) * magnitude };
    },
    update(dt) {
      for (const p of pool) {
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        const dragFactor = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragFactor;
        p.vy = p.vy * dragFactor + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        texts[i].life -= dt;
        texts[i].y -= 46 * dt;
        if (texts[i].life <= 0) texts.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of pool) {
        if (!p.active) continue;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
          ctx.globalAlpha = alpha * 0.25;
          ctx.fill();
          ctx.globalAlpha = alpha;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const t of texts) {
        const alpha = Math.max(0, t.life / t.maxLife);
        ctx.globalAlpha = alpha;
        ctx.font = `700 ${t.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(5, 6, 10, 0.85)';
        ctx.strokeText(t.value, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    reset() {
      for (const p of pool) p.active = false;
      texts.length = 0;
      trauma = 0;
    },
  };
}
