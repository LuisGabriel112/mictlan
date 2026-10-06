export function createRngState(seed: number): number {
  return seed >>> 0;
}

// Mulberry32: the constants below belong to the algorithm, not game balance.
// All state is explicit so callers can store it in EncounterState and replay it.
export function nextRandom(rngState: number): { rngState: number; value: number } {
  const nextState = (rngState + 0x6d2b79f5) >>> 0;
  let mixed = Math.imul(nextState ^ (nextState >>> 15), nextState | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

  return {
    rngState: nextState,
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 0x100000000,
  };
}
