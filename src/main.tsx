import * as THREE from "three";
import 'mathlive';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { eulerStep } from "./core/integrator";
import type { MathfieldElement } from "mathlive";



import { create, all, type MathNode } from "mathjs";
import { parseSystem } from "./core/parser";
import type { State } from "./core/types";
const math = create(all);

function initThree(container: HTMLElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  scene.add(new THREE.AxesHelper(5));

  const points: THREE.Vector3[] = [];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();


  return {
    addPoint: (x: number, y: number, z: number) => {
      // Add to trajectory line
      points.push(new THREE.Vector3(x, y, z));
      geometry.setFromPoints(points);

      // Add a small sphere at the new point
      const sphereGeo = new THREE.SphereGeometry(0.05, 8, 8); // radius 0.05
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      scene.add(sphere);
    },
  };
}

/**
 * Small sanitizer for MathLive output and Unicode:
 */
function normalizeInput(expr: string): string {
  return expr
    // Convert things like (d y)/(d t) or ( d y )/( d t ) → dy/dt
    .replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*([A-Za-z_]\w*)\s*\)/g, 'd$1/d$2')
    // remove any spaces and weird minus signs
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "");
}

/** Equation representation */
type Eq = {
  raw: string;
  // dependent variable name (e.g., "y")
  dep?: string;
  // independent variable name (e.g., "t", "x") or null for algebraic
  indep?: string | null;
  // RHS expression string (already transformed so derivative term removed)
  expr: string;
  // compiled mathjs function for expr
  compiled?: any;
  // AST node (optional)
  node?: MathNode;
};

/** Updater structure */
export type Updater = {
  indep: string | null;
  dependents: string[]; // variables this updater will produce updates for
  // For indep != null: (state, indepValue, dIndep) => Partial<state>
  // For indep == null: (state) => Partial<state>
  updateFn: Function;
};

/**
 * Parse user equations into Eq[] where each eq is either:
 *  - derivative: dep and indep set, expr gives RHS (as string)
 *  - algebraic: indep = null, dep set (if LHS is variable) or dep undefined (if it's a pure expression)
 *
 * Supported forms:
 *  - dy/dt = f(x,y,t)
 *  - (d y)/(d t) = f(...)  (normalized)
 *  - y = expression  (algebraic)
 *  - vx = y  (treated as algebraic assignment)
 */



/**
 * Build updaters from equations.
 *
 * Rules:
 *  - Group derivative equations by their independent variable (e.g. 't', 'x').
 *  - For each group:
 *      - if group size > 1: make a coupled-system updater (vector function) and return updateFn that advances all dependents wrt that independent variable
 *      - if group size == 1: make a scalar updater that updates a single variable when the independent variable steps
 *  - For algebraic equations (indep === null): create assignment updaters that compute the RHS immediately from state.
 *
 * Update function signatures:
 *  - For derivatives group with indep 'I': updateFn(state: Record<string,number>, Ivalue: number, dI: number) => Partial<Record<string,number>>
 *      (Euler step used: nextVar = var + f(state, Ivalue)*dI)
 *  - For algebraic: updateFn(state) => Partial<Record<string,number>>
 */
export function buildUpdaters(eqs: Eq[], options?: { integrator?: "euler" | "rk4" }): Updater[] {
  const integrator = options?.integrator ?? "euler";

  // group derivatives by indep
  const derivGroups: Record<string, Eq[]> = {};
  const algebraics: Eq[] = [];

  for (const e of eqs) {
    if (typeof e.indep === "string" && e.dep) {
      (derivGroups[e.indep] ||= []).push(e);
    } else {
      algebraics.push(e);
    }
  }

  const updaters: Updater[] = [];

  // Algebraic updaters: immediate assignment functions
  for (const a of algebraics) {
    // if a.dep exists -> assignment Var = expr
    if (a.dep) {
      const varName = a.dep;
      const fn = (state: Record<string, number>) => {
        // evaluate with mathjs
        const scope = { ...state };
        let val;
        try { val = a.compiled.evaluate(scope); } catch { val = NaN; }
        return { [varName]: val };
      };
      updaters.push({ indep: null, dependents: [varName], updateFn: fn });
    } else {
      // pure expression (no LHS var). We'll store result under the raw expr key.
      const key = a.raw;
      const fn = (state: Record<string, number>) => {
        const scope = { ...state };
        let val;
        try { val = a.compiled.evaluate(scope); } catch { val = NaN; }
        return { [key]: val };
      };
      updaters.push({ indep: null, dependents: [], updateFn: fn });
    }
  }

  // Derivative groups
  for (const indep of Object.keys(derivGroups)) {
    const group = derivGroups[indep];

    if (group.length === 1) {
      // single scalar derivative dV/dI = f(...)
      const e = group[0];
      const varName = e.dep!;
      const compiled = e.compiled;
      const fn = (state: Record<string, number>, Ivalue: number, dI: number) => {
        const scope = { ...state };
        // if user wants independent var included in scope (e.g., t or x), include it
        scope[indep] = Ivalue;
        let dv;
        try { dv = compiled.evaluate(scope); } catch { dv = NaN; }
        const prev = typeof state[varName] === "number" ? state[varName] : 0;
        const next = isFinite(dv) ? prev + dv * dI : NaN;
        return { [varName]: next };
      };
      updaters.push({ indep, dependents: [varName], updateFn: fn });
    } else {
      // coupled system: build vector function f(state, I) -> derivatives array
      const vars = group.map(g => g.dep!);
      // compile system-level evaluator that returns an object of dvar/dindep
      const compiledFns = group.map(g => g.compiled);
      const fn = (state: Record<string, number>, Ivalue: number, dI: number) => {
        const scope = { ...state, [indep]: Ivalue };
        const derivatives: Record<string, number> = {};
        for (let i = 0; i < vars.length; i++) {
          try { derivatives[vars[i]] = compiledFns[i].evaluate(scope); } catch { derivatives[vars[i]] = NaN; }
        }

        // Euler step for the group (vector)
        const next: Record<string, number> = {};
        for (const v of vars) {
          const prev = typeof state[v] === "number" ? state[v] : 0;
          const dv = derivatives[v];
          next[v] = isFinite(dv) ? prev + dv * dI : NaN;
        }
        return next;
      };

      updaters.push({ indep, dependents: vars, updateFn: fn });
    }
  }

  return updaters;
}


window.addEventListener("DOMContentLoaded", async () =>   {
  await customElements.whenDefined("math-field");

  const fields: MathfieldElement[] = [
    document.getElementById("eq1") as MathfieldElement,
    document.getElementById("eq2") as MathfieldElement
  ];

  const plotContainer = document.getElementById("plot")!;
  const plot = initThree(plotContainer);

  let currentSystem: any;
  let state: Record<string, number> = {x:0, y: 1, z:0.5};
  let t = 0;

  function updateSystem() {
    const expr = fields
      .map((f) => normalizeInput(f.getValue("ascii-math")))
      .filter(Boolean)
      .join("; ");

    console.log("Normalized expressions:", expr);

    try {
      currentSystem = parseSystem(expr);
      console.log('Parsed system:', currentSystem);
      // state = { ...currentSystem.initialState };
      console.log("Parsed system:", currentSystem);
    } catch (err) {
      console.error("Parse error:", err);
    }
  }

  fields.forEach((f) => {
    f.addEventListener("input", updateSystem);
    f.addEventListener("change", updateSystem);
  });

  updateSystem(); // initial parse

  const stepBtn = document.getElementById("stepBtn")!;
  stepBtn.addEventListener("click", () => {
    console.log("Stepping...");
    if (!currentSystem) return;
    const dt = 0.025;
    state = eulerStep(currentSystem, state, t, dt);
    t += dt;

    const x = state.x ?? 0;
    const y = state.y ?? 0;
    const z = state.z ?? 0;

    plot.addPoint(x, y, z);

    console.log(`t=${t.toFixed(2)} state:`, state);
  });
});
