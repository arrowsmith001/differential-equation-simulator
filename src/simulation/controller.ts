import { InitialConditionsChangeEvent } from "@/main";
import { State } from "../core/parser";
import { Expression, System } from "../core/system";


const defaultT = 0;

type Listener<T> = (payload: T) => void;

interface SimulationEvents {
  onReset?: Listener<void>;
  onInitialConditionsChanged?: Listener<InitialConditionsChangeEvent>;
  onSystemChange?: Listener<System>;
  onTrajectory?: Listener<State[]>;
}

export class SimulationController {
  private system?: System;
  private listeners: SimulationEvents = {};

  private isPlaying = false;

  private initialPoint?: State;

  public getIsPlaying() {
    return this.isPlaying;
  }

  constructor(initialSystem?: System, initialPoint?: State) {
    this.system = initialSystem;
    this.initialPoint = initialPoint;
    requestAnimationFrame(this.simulateFrame);
  }

  on(listeners: Partial<SimulationEvents>) {
    Object.assign(this.listeners, listeners);
  }

  setEquations(exprs: Expression[]) {
    this.system = new System(exprs, this.initialPoint, 0); // resets time
    this.listeners.onSystemChange?.(this.system);
    // this.run();
  }

  updateInitialConditions(ic: InitialConditionsChangeEvent) {
    this.initialPoint = ({ ...this.initialPoint, ...ic, t: undefined });

    this.system?.setState(this.initialPoint);
    if(ic.t) this.system?.setStartTime(ic.t);
    
    this.system?.setT(this.system?.startTime);

    this.listeners.onInitialConditionsChanged?.(ic);
    // this.run();
  }

  public play() {
    this.isPlaying = true;
  }

  public pause() {
    this.isPlaying = false;
    this.lastFrameTime = undefined;
  }

  public toggle() {
    if(this.isPlaying) this.pause();
    else this.play();
  }

  public reset() {
    const wasPlaying = this.isPlaying;
    this.pause();

    if(this.initialPoint) this.system?.setState(this.initialPoint);
    this.system?.setT(this.system.startTime);

    if(wasPlaying) this.play();
    this.listeners.onReset?.();
  }

  private lastFrameTime: number | undefined = undefined;
  private dt = 0.1; // simulation timestep

  // Main animation loop
  private simulateFrame = () => {

    requestAnimationFrame(this.simulateFrame);

    if (!this.isPlaying || !this.system) return;

    const time = performance.now();

    // skips the first frame, preventing a large jump in dt
    if (!this.lastFrameTime) {
      this.lastFrameTime = time;
      return;
    }

    let elapsed = (time - this.lastFrameTime) / 1000; // seconds
    this.lastFrameTime = time;

    elapsed = Math.min(elapsed, 0.1); // clamp max timestep

    let state = this.system.getState();
    let remaining = elapsed;
    const points = [{ ...state }];

    while (remaining > 0) {
      const step = Math.min(this.dt, remaining);
      
      state = this.system.step(step);
      
      points.push({ ...state });
      remaining -= step;
    }

    // console.debug(JSON.stringify(points));
    // console.debug(`Simulated ${points.length} frames in ${elapsed.toFixed(2)} seconds`);
    // console.debug(`${this.system.t}`);

    this.listeners.onTrajectory?.(points);
  }

  // run(totalTime = 10, dt = 0.01) {
  //   const trajectory = this.system.integrate(totalTime, dt);
  //   this.listeners.onTrajectory?.(trajectory);
  // }

  getSystem() {
    return this.system;
  }
}