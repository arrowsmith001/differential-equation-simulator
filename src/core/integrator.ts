import { DifferentialSystem } from "./parser";
import type { VectorSystem, State } from "./types";

export function eulerStep(sys: DifferentialSystem, state: State, t: number, dt: number): State {

  const nextState: State = {};
  for (const v of sys.variables) {
    nextState[v] = state[v] + dt * sys.derivatives[v](state, t);
  }
  return nextState;
}