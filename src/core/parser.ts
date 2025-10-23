
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

const DERIVATIVE_REGEX = /^\(?d([A-Za-z]\w*)\)?\/\(?d[tT]\)?$/;
const VECTOR_REGEX = /(\[\[|\(\()(.+?,.+?)(\]\]|\)\))/g;

type Fn = (state: Record<string, number>, t: number, helpers?: Record<string, number>) => number;

export class System {
  private variableFnMap: Record<string, Fn> = {}; // canonical variables
  private helperFnMap: Record<string, Fn> = {};   // aliases / helpers
  private helperDependencies: Record<string, Set<string>> = {};
  private vectorAliases: Record<string, string[]> = {}; // r -> ['x','y','z']
  private state: Record<string, number> = {};
  private t: number = 0;

  constructor(exprs: string[], initialState?: Record<string, number>, t: number = 0) {
    if (initialState) this.state = { ...initialState };
    const expandedExprs: string[] = [];

    // Frontload vector expansion
    for (const expr of exprs) {
      const decomposed = this.expandVectors(expr);
      expandedExprs.push(...decomposed);
    }

    // Parse scalar expressions
    for (const expr of expandedExprs) this.parseExpression(expr);

    this.t = t;
    console.debug("Parsed system:");
    console.debug("Variables:", this.getVariables());
    console.debug("Helpers:", this.getHelpers());
    console.debug("Aliases:", this.vectorAliases);
  }

  /** Expand vectors: handles aliases r=((x,y,z)) or derivatives d((x,y,z))/dt */
  private expandVectors(expr: string): string[] {

    console.debug("Expanding vectors in expression:", expr);

    // detect derivative alias like dr/dt = ((y,-x,x+y))
    const derivativeAliasMatch = expr.match(/^\s*d([A-Za-z]\w*)\/d[tT]\s*=\s*(\[\[|\(\().+(\]\]|\)\))\s*$/);
    if (derivativeAliasMatch) {
      const alias = derivativeAliasMatch[1];
      const vectorPart = derivativeAliasMatch[0].split('=').slice(1).join('=').trim();

      const decomposed = this.expandVectors(vectorPart);
      const components = decomposed.map(s => s.trim());

      // Check if alias corresponds to a known vector
      const aliasComponents = this.vectorAliases[alias];
      if (aliasComponents) {
        const scalarExprs: string[] = [];
        aliasComponents.forEach((comp, idx) => {
          const newExpr = `d${comp}/dt = ${components[idx]}`;
          scalarExprs.push(newExpr);
        });
        return scalarExprs;
      }

      // Fallback: expand to r_i if alias not yet defined
      const scalarExprs: string[] = components.map((rhs, idx) => `d${alias}_${idx + 1}/dt = ${rhs}`);
      return scalarExprs;
    }


    const matches = [...expr.matchAll(VECTOR_REGEX)];
    if (!matches.length) return [expr]; // no vectors → return unchanged

    const componentsList = matches.map(m => m[2].split(/\s*,\s*/).map(s => s.trim()));
    const dimension = componentsList[0].length;

    if (!componentsList.every(c => c.length === dimension))
      throw new Error("Mismatched vector dimensions in expression: " + expr);

    // Detect alias like r = ((x,y,z))
    const aliasMatch = expr.match(/^\s*([A-Za-z]\w*)\s*=\s*(\[\[|\(\().+(\]\]|\)\))\s*$/);
    if (aliasMatch) {
      const alias = aliasMatch[1];
      const components = componentsList[0].map(c => c.replace(/\s/g, ''));
      this.vectorAliases[alias] = components;

      return []; // alias handled, no further equations needed
    }

    // Otherwise decompose into N scalar equations with unique component names
    console.debug("componentsList:", componentsList);
    const scalarExprs: string[] = [];
    for (let i = 0; i < dimension; i++) {
      let newExpr = expr;
      matches.forEach((v, idx) => {
        console.debug("Expanding vector:", v[0], "to component:", componentsList[idx]);
        newExpr = newExpr.replace(v[0], componentsList[idx][i]);
        console.debug("Intermediate expression:", newExpr);
      });
      scalarExprs.push(newExpr);
    }

    console.debug("Decomposed vector expression into scalar expressions:", scalarExprs);

    return scalarExprs;
  }

  private parseExpression(expr: string) {
    let [lhs, rhs] = expr.split("=").map(s => s.trim());
    if (!lhs || !rhs) return;

    // Swap derivative if RHS is a derivative
    if (DERIVATIVE_REGEX.test(rhs)) [lhs, rhs] = [rhs, lhs];

    const derivativeMatch = lhs.match(DERIVATIVE_REGEX);
    if (derivativeMatch) {
      const variable = derivativeMatch[1];
      const compiled = math.parse(rhs);
      console.debug(`Compiling derivative for variable "${variable}":`, rhs);
      this.variableFnMap[variable] = (_state, t, helpers) =>
        compiled.evaluate({ ..._state, ...helpers, t });
      return;
    }

    // Compile scalar helper
    const compiled = math.parse(rhs);
    this.helperFnMap[lhs] = (state, t, helpers) => {
      return compiled.evaluate({ ...state, ...helpers, t }); // ALWAYS returns a number
    };
    this.helperDependencies[lhs] = this.extractDependencies(rhs);
  }

  evaluateAll(): Record<string, number> {
    const helpersEvaluated = this.evaluateHelpers();
    const result: Record<string, number> = {};
    for (const [variable, fn] of Object.entries(this.variableFnMap))
      result[variable] = fn(this.state, this.t, helpersEvaluated);
    return { ...helpersEvaluated, ...result };
  }
  private extractDependencies(expr: string): Set<string> {
    const deps = new Set<string>();
    const regex = /\b[A-Za-z_]\w*\b/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(expr))) {
      const name = match[0];
      if (!isNaN(Number(name))) continue;
      if ((math as any)[name]) continue;
      deps.add(name);
    }
    return deps;
  }

  getVariables(): string[] { return Object.keys(this.variableFnMap).sort(); }
  getHelpers(): string[] { return Object.keys(this.helperFnMap).sort(); }

  setState(state: Record<string, number>, t?: number) {
    this.state = { ...state };
    if (t !== undefined) this.t = t;
  }

  getState(): Record<string, number> { return { ...this.state }; }

  evaluateVar(name: string): number {

    // first check helpers (aliases)
    if (this.helperFnMap[name]) return this.helperFnMap[name](this.state, this.t, this.evaluateHelpers());
    // then canonical variables
    if (this.variableFnMap[name]) return this.variableFnMap[name](this.state, this.t, this.evaluateHelpers());

    throw new Error(`Unknown variable: ${name}`);
  }

  private evaluateHelpers(): Record<string, number> {
    const evaluated: Record<string, number> = {};
    const visited = new Set<string>();

    const evalHelper = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const deps = this.helperDependencies[name] || new Set();
      for (const dep of deps) if (this.helperFnMap[dep]) evalHelper(dep);

      const val = this.helperFnMap[name](this.state, this.t, evaluated);

      if (typeof val !== 'number') {
        throw new Error(`Helper "${name}" evaluated to non-scalar value: ${val}`);
      }

      evaluated[name] = val;
    };

    for (const h of Object.keys(this.helperFnMap)) evalHelper(h);
    return evaluated;
  }
}

export function parseSystem(exprs: string[], initialState?: Record<string, number>): System {
  console.debug("Parsing system with expressions:", exprs);
  return new System(exprs, initialState);
}