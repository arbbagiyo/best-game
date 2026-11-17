// A small seeded random stream (mulberry32): the same seed deals the same
// game, which is what makes the staged screenshot scenes repeatable.

export function createRandom(seed) {
  let state = seed | 0;
  return function random() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** An integer in [min, max]. */
export function intIn(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** True with the given probability. */
export function chance(random, probability) {
  return random() < probability;
}

/** One element of an array, uniformly. */
export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}
