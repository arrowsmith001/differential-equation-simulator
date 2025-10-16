import type { DifferentialSystem } from "./types";

export function eulerStep(sys: DifferentialSystem, state: Record<string, number>, t: number, dt: number) {
  const diff = sys.fn(state, t);
  const next = { ...state };

    console.log('eulerStep diff: ' + JSON.stringify(diff));

  for (const key in diff) {
    const match = key.match(/^d(\w+)\/dt$/);
    if (!match) throw new Error(`Bad derivative key: ${key}`);
    const varName = match[1]; // x, y, etc.

    console.log('varName: ' + varName);

    // sanity check: state must have this variable
    if (typeof state[varName] !== "number") {
      console.warn(`Missing variable in state: ${varName}`);
      next[varName] = diff[key] * dt; // init to derivative*dt
    } else {
      next[varName] = state[varName] + diff[key] * dt;
    }
  }

  return next;
}
