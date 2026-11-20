// rng.js — seeded random numbers so the city is the same every run.
// mulberry32: a tiny deterministic generator. Same seed, same city.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one element of an array with the seeded rng.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Random number between lo and hi.
export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
