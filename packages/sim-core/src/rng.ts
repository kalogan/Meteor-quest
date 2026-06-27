/**
 * Deterministic, seedable RNG (mulberry32 + splitmix32 seeding). The core NEVER
 * calls Math.random — randomness is injected via this so any seed reproduces an
 * identical galaxy (required by tests and the preview harness identity-seed).
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Pick an element (throws on empty). */
  pick<T>(arr: readonly T[]): T;
  /** An independent stream derived from this one (for sub-system isolation). */
  fork(salt: number): Rng;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const gen = mulberry32(seed >>> 0);
  const rng: Rng = {
    next: gen,
    int: (maxExclusive: number) => Math.floor(gen() * maxExclusive),
    range: (min: number, max: number) => min + gen() * (max - min),
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error("pick from empty array");
      return arr[Math.floor(gen() * arr.length)] as T;
    },
    fork: (salt: number) => createRng((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0),
  };
  return rng;
}
