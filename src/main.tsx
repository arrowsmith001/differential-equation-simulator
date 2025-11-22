import 'mathlive';
import { Plot } from './ui/plot';
import { SimulationController } from './simulation/controller';
import { State } from './core/parser';
import { ControlPanel } from './ui/control_panel';
import { Expression } from './core/system';


export interface SystemCallbacks {
  onInitialConditionsChanged?: (initConditions: InitialConditionsChangeEvent) => void,
  onSystemChanged: (exprs: Expression[]) => void,
}

export type InitialConditionsChangeEvent = {
  t?: number,
  x?: number,
  y?: number,
  z?: number,
}

window.addEventListener("DOMContentLoaded", async () => {

  const plotElement = document.getElementById("plot")!;
  const panelElement = document.getElementById("initial-form")!;

  const controller = new SimulationController();

  const handlers: SystemCallbacks = {
    onInitialConditionsChanged(ic) { controller.updateInitialConditions(ic); },
    onSystemChanged(exprs: Expression[]) { controller.setEquations(exprs); },
  };

  const plot = new Plot(plotElement, handlers);
  const panel = new ControlPanel(panelElement, handlers);

  controller.on({
    onInitialConditionsChanged: (ic) => {
      const state = { x: ic.x, y: ic.y, z: ic.z };
      plot.clear();
      plot.updateStartPoint(state);
      panel.updateInitialConditionsUI(state, ic.t);
    },
    onSystemChange: (system) => {
      plot.clear();
      panel.setExpressionsInUi(system.getExpressions());
    },
    onTrajectory: (points) => plot.appendTrajectory(points),
    onReset: () => {
      plot.clear();
    }
  });

  controller.updateInitialConditions({t: 0, x: 1, y: 1, z: 1 });
  controller.setEquations(
    [{ "latex": "\\frac{dx}{dt}=\\sigma\\left(y-x\\right)", "asciiMath": "(d x)/(d t)=sigma(y-x)", "sanitized": "dx/dt=sigma(y-x)" }, { "latex": "\\frac{dy}{dt}=x\\left(\\rho-z\\right)-y", "asciiMath": "(d y)/(d t)=x(rho-z)-y", "sanitized": "dy/dt=x(rho-z)-y" }, { "latex": "\\frac{dz}{dt}=xy-\\beta z", "asciiMath": "(d z)/(d t)=x y-beta z", "sanitized": "dz/dt=x y-beta z" }, { "latex": "\\rho=28", "asciiMath": "rho=28", "sanitized": "rho=28" }, { "latex": "\\sigma=10", "asciiMath": "sigma=10", "sanitized": "sigma=10" }, { "latex": "\\beta=\\frac83", "asciiMath": "beta=(8)/(3)", "sanitized": "beta=(8)/(3)" }]
  );


  // TODO: Give expressions a LATEX and SANTISED representation - avoids this jankiness!!!
  // panel.inputRawEquations([
  //   "\\frac{dx}{dt}=\\sigma\\left(y-x\\right)", "\\frac{dy}{dt}=x\\left(\\rho-z\\right)-y", "\\frac{dz}{dt}=xy-\\beta z", "\\rho=28", "\\sigma=10", "\\beta=\\frac83"
  // ]);
  console.debug('sani: ' + JSON.stringify(panel.getSantisedEquations()));
  handlers.onSystemChanged(panel.getSantisedEquations());

  // Play/pause button
  const playBtn = document.getElementById("playBtn")!;
  const refreshBtn = document.getElementById("refreshBtn")!;

  playBtn.addEventListener("click", () => {
    controller.toggle();
    if (controller.getIsPlaying()) playBtn.textContent = "Pause";
    else playBtn.textContent = "Play";
  });

  refreshBtn.addEventListener("click", () => {
    controller.reset();
  });

  window.addEventListener("keydown", (e) => {
    // check that focus isn’t in an input or mathfield
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "MATH-FIELD") return;

    if (e.code === "Space") {
      e.preventDefault();
      controller.toggle();
    }
  });

});




