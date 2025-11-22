import { State, SystemDefinition } from "./parser";

export interface Integrator {
  step(system: System, dt: number): State;
}

export const EulerIntegrator: Integrator = {
  step(system, dt) {
    const state = system.getState();
    const deriv = system.evaluateDerivatives();

    for (const key in deriv) {
      state[key]! += deriv[key]! * dt;
    }
    system.t += dt;
    return { ...state };
  },
};

export type Expression = {
  sanitized: string,
  latex?: string,
  asciiMath?: string,
} 

export class System {
  evaluateVar(v: string) {
    return this.definition.evaluateVar(v, this.state, this.t);
  }

  definition: SystemDefinition;
  state: State;
  integrator: Integrator;

  startTime: number = 0;
  t: number = 0;

  constructor(expr: Expression[], initial: State = {}, t = 0, integrator: Integrator = EulerIntegrator) {
    this.definition = new SystemDefinition(expr);
    this.state = { ...initial };
    this.integrator = integrator;
    this.t = t;
  }

  step(dt: number) : State {
    const newState = this.integrator.step(this, dt);
    this.state = newState;
    return newState;
  }

  integrate(totalTime: number, dt: number) {
    const traj: State[] = [];
    while (this.t < totalTime) {
        traj.push(this.step(dt));
    }
    return traj;
  }
  
  setStartTime(startTime: number) {
    this.startTime = startTime;
  }

  evaluateDerivatives(): State {
    return this.definition.evaluateAll(this.state, this.t);
  }

  setIntegrator(integrator: Integrator) {
    this.integrator = integrator;
  }

  getState() {
    return { ...this.state };
  }

  setState(newState: State) {
    this.state = { ...newState };
  }

  setT(t: number) {
    this.t = t;
  }

  getExpressions(): Expression[] {
    return this.definition.getExpressions();
  }

  getVariables(): string[] {
    return this.definition.getVariables();
  }
}