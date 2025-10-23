import { System } from "./parser";
import type { State } from "./types";

export function eulerStep(sys: System, t: number, dt: number): State {

  const state: State = sys.getState();
  const nextState: State = {};
  for (const v of sys.getVariables()) {
    // console.debug(`Evaluating derivative for ${v} at t=${t}, state=${JSON.stringify(state)}`);
    nextState[v] = state[v] + dt * sys.evaluateVar(v);
  }
  return nextState;
}