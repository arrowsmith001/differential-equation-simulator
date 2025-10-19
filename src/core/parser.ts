
import { create, all, MathNode, EvalFunction, e } from "mathjs";

const math = create(all);

type CompiledEquation = {
  variable: string;
  fn: any;
};

const compiled: CompiledEquation[] = [];

// ---------------------- Types ----------------------
export type State = Record<string, number>;

export interface DifferentialSystem {
  variables: string[];
  indepVar: string;
  derivatives: Record<string, (state: State, t: number) => number>;
  initialState: State;
}


// ---------------------- Helper: normalize derivatives ----------------------
function normalizeInput(input: string): string[] {
  return input
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*t\s*\)/g, "d$1/dt")) // (d y)/(d t) -> dy/dt
    .map(s => s.replace(/[−–—]/g, "-")) // replace unicode minus
    .map(s => s.replace(/\s+/g, "")); // remove whitespace
}

const DERIVATIVE_REGEX = /^d([A-Za-z]\w*)\/d[tT]$/;
const VECTOR_REGEX = /^(\[\[|\(\()(.+?,.+?)(\]\]|\)\))$/;
const VECTOR_DERIVATIVE_REGEX = /^\(?d\(\(([^)]+)\)\)\)?\/?\(?dt\)?$/;


type Fn = (state: Record<string, number>, t: number, helpers?: Record<string, number>) => number;

export class System {
  private variableFnMap: Record<string, Fn> = {}; // canonical variables
  private helperFnMap: Record<string, Fn> = {};   // aliases / helpers
  private helperDependencies: Record<string, Set<string>> = {};
  private state: Record<string, number> = {};
  private t: number = 0;

  constructor(exprs: string[], initialState?: Record<string, number>, t: number = 0) {
    if (initialState) this.state = { ...initialState };
    for (const expr of exprs) this.parseExpression(expr);
    this.t = t;
  }

  private parseExpression(expr: string) {
    let [lhs, rhs] = expr.split("=").map(s => s.trim());
    if (!lhs || !rhs) return;

    // Swap derivative to LHS if needed
    if (DERIVATIVE_REGEX.test(rhs)) [lhs, rhs] = [rhs, lhs];

    // Canonical derivative
    const derivativeMatch = lhs.match(DERIVATIVE_REGEX);
    if (derivativeMatch) {
      const variable = derivativeMatch[1];
      const compiled = math.parse(rhs); // compile once
      this.variableFnMap[variable] = (_state, t, helpers) =>
        compiled.evaluate({ ..._state, ...helpers, t });
      return;
    }

    const vectorDerivMatch = lhs.match(VECTOR_DERIVATIVE_REGEX);
    // Vector helper
    if (vectorDerivMatch) {
      const variables = vectorDerivMatch[1]
        .split(/\s*,\s*/)
        .map(v => v.trim());

      const rhsMatch = rhs.match(VECTOR_REGEX);
      if (!rhsMatch) throw new Error(`Vector derivative must equal a vector RHS: ${expr}`);

      const components = rhsMatch[2]
        .split(/\s*,\s*/)
        .map(s => s.trim());

      if (components.length !== variables.length)
        throw new Error(`Mismatched vector length in ${expr}`);

      // Pair each variable with a compiled component
      variables.forEach((variable, i) => {
        const sanitized = components[i]; // optional helper
        const compiled = math.compile(sanitized); // <-- use compile here per component
        this.variableFnMap[variable] = (_state, t, helpers) => {
          const scope = { ..._state, ...helpers, t };
          const val = compiled.evaluate(scope); // safe, scalar
          return val;
        };
      });

      return;
    }


    const compiled = math.parse(rhs);

    this.helperFnMap[lhs] = (state, t, helpers) => {
      console.debug(`Evaluating vector component ${lhs} with expression ${JSON.stringify(state)}`);
      return compiled.evaluate({ ...state, ...helpers, t });
    }
    this.helperDependencies[lhs] = this.extractDependencies(rhs);
  }

  // parse expression to find which variables it depends on
  private extractDependencies(expr: string): Set<string> {
    const deps = new Set<string>();
    const regex = /\b[A-Za-z_]\w*\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expr))) {
      const name = match[0];
      // ignore numbers
      if (!isNaN(Number(name))) continue;
      // ignore function names
      if ((math as any)[name]) continue;
      deps.add(name);
    }
    return deps;
  }

  getVariables(): string[] {
    return Object.keys(this.variableFnMap).sort();
  }

  getHelpers(): string[] {
    return Object.keys(this.helperFnMap).sort();
  }

  setState(state: Record<string, number>, t?: number) {
    this.state = { ...state };
    if (t !== undefined) this.t = t;
  }

  setTime(t: number) {
    this.t = t;
  }

  getState(): Record<string, number> {
    return { ...this.state };
  }

  private evaluateHelpers(): Record<string, number> {
    const evaluated: Record<string, number> = {};
    const tempVisited = new Set<string>();
    const permVisited = new Set<string>();

    const visit = (v: string) => {
      if (permVisited.has(v)) return;
      if (tempVisited.has(v)) throw new Error(`Cyclic dependency detected: ${v}`);
      tempVisited.add(v);
      const deps = this.helperDependencies[v] || new Set();
      for (const d of deps) {
        if (this.helperFnMap[d]) visit(d);
      }
      tempVisited.delete(v);
      permVisited.add(v);
      evaluated[v] = this.helperFnMap[v]({ ...this.state, ...evaluated }, this.t, evaluated);
    };

    for (const helper of Object.keys(this.helperFnMap)) visit(helper);

    return evaluated;
  }

  evaluateAll(): Record<string, number> {
    const helpersEvaluated = this.evaluateHelpers();
    const result: Record<string, number> = {};

    for (const [variable, fn] of Object.entries(this.variableFnMap)) {
      result[variable] = fn(this.state, this.t, helpersEvaluated);
    }

    return { ...helpersEvaluated, ...result };
  }

  evaluateVar(name: string): number {
    console.debug("Evaluating variable:", name);
    const helpersEvaluated = this.evaluateHelpers();
    if (this.variableFnMap[name]) return this.variableFnMap[name](this.state, this.t, helpersEvaluated);
    if (this.helperFnMap[name]) return this.helperFnMap[name](this.state, this.t, helpersEvaluated);
    throw new Error(`Unknown variable: ${name}`);
  }
}

export function parseSystem(exprs: string[], initialState?: Record<string, number>): System {
  console.debug("Parsing system with expressions:", exprs);
  return new System(exprs, initialState);
}