
import { create, all } from "mathjs";
import { Expression, System } from "./system";
const math = create(all);

export function parseSystem(exprs: Expression[]): System {
  console.debug("Parsing system with expressions:", exprs);
  return new System(exprs);
}

export type State = Record<string, number | undefined>;

const DERIVATIVE_REGEX = /^\(?d([A-Za-z]\w*)\)?\/\(?d\s*[tT]\)?$/;
const VECTOR_REGEX = /(\[\[|\(\()(.+?,.+?)(\]\]|\)\))/g;
const KNOWN_FUNCTIONS = [
  'sin', 'cos', 'tan', 'exp', 'sqrt', 'abs',
  'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'pow', 'min', 'max'
];

// Match any identifier that isn't a known function, followed by '('
const fnPattern = KNOWN_FUNCTIONS.join('|');

type Fn = (state: State, t: number, helpers?: Record<string, number>) => number;

export class SystemDefinition {

  private compiled : CompiledSystem;

  constructor(expr: Expression[]) {
    this.compiled = new CompiledSystem(expr);
  }

  public evaluateAll(state: State, t: number): State {
    const helpersEvaluated = this.evaluateHelpers(state, t);
    const result: Record<string, number | undefined> = {};
    for (const [variable, fn] of Object.entries(this.compiled.variableFnMap))
      result[variable] = fn(state, t, helpersEvaluated);
    return { ...helpersEvaluated, ...result };
  }

  public evaluateVar(name: string, state: State, t: number): number {

    // first check helpers (aliases)
    if (this.compiled.helperFnMap[name]) return this.compiled.helperFnMap[name](state, t, this.evaluateHelpers(state, t));
    // then canonical variables
    if (this.compiled.variableFnMap[name]) return this.compiled.variableFnMap[name](state, t, this.evaluateHelpers(state, t));

    throw new Error(`Unknown variable: ${name}`);
  }

  private evaluateHelpers(state: State, t: number): Record<string, number> {
    const evaluated: Record<string, number> = {};
    const visited = new Set<string>();

    const evalHelper = (name: string) => {
      if (visited.has(name)) return;
      visited.add(name);

      const deps = this.compiled.helperDependencies[name] || new Set();
      for (const dep of deps) if (this.compiled.helperFnMap[dep]) evalHelper(dep);

      const val = this.compiled.helperFnMap[name](state, t, evaluated);

      if (typeof val !== 'number') {
        throw new Error(`Helper "${name}" evaluated to non-scalar value: ${val}`);
      }

      evaluated[name] = val;
    };

    for (const h of this.compiled.helpers) evalHelper(h);
    return evaluated;
  }

  public getExpressions(): Expression[] {
    return this.compiled.expressions;
  }

  public getVariables(): string[] {
    return this.compiled.variables;
  }

}

class CompiledSystem {

  public readonly expressions: Expression[];
  public readonly variableFnMap: Record<string, Fn> = {}; // canonical variables
  public readonly helperFnMap: Record<string, Fn> = {};   // aliases / helpers
  public readonly helperDependencies: Record<string, Set<string>> = {};
  public readonly vectorAliases: Record<string, string[]> = {}; // r -> ['x','y','z']
  public readonly variables : string[]; // canonical variables
  public readonly helpers : string[]; // aliases / helpers

  constructor(exprs: Expression[]) {
    this.expressions = exprs;
    const expandedExprs: string[] = [];

    // Frontload vector expansion
    for (const expr of exprs) {
      const decomposed = this.expandVectors(expr.sanitized);
      expandedExprs.push(...decomposed);
    }

    // Parse scalar expressions
    for (const expr of expandedExprs) this.parseExpression(expr);

    this.variables = Object.keys(this.variableFnMap).sort();
    this.helpers = Object.keys(this.helperFnMap).sort();

    // console.debug("Parsed system:");
    // console.debug("Variables:", this.variables);
    // console.debug("Helpers:", this.helpers);
    // console.debug("Aliases:", this.vectorAliases);
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

      return [];
    }

    // Otherwise decompose into N scalar equations with unique component names
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


  private preprocessExpression(expr: string): string {

    // Add * between two variable-like tokens separated by whitespace
    // e.g. "x y" -> "x*y", "beta z" -> "beta*z"
    expr = expr.replace(/([A-Za-z_]+)\s+([A-Za-z_]+)/g, '$1*$2');

    // Add * before parentheses if it's not a known function
    // e.g. "sigma(y-x)" -> "sigma*(y-x)", but "sin(x)" -> "sin(x)"
    expr = expr.replace(
      new RegExp(`(?<!\\b(?:${fnPattern})\\b)\\s*([A-Za-z_]+)\\s*\\(`, 'g'),
      '$1*('
    );

    return expr;
  }

  private parseExpression(expr: string) {
    let [lhs, rhs] = expr.split("=").map(s => s.trim());
    if (!lhs || !rhs) return;

    // Swap derivative if RHS is a derivative
    if (DERIVATIVE_REGEX.test(rhs)) [lhs, rhs] = [rhs, lhs];

    const derivativeMatch = lhs.match(DERIVATIVE_REGEX);
    if (derivativeMatch) {
      const variable = derivativeMatch[1];
      const cleaned = this.preprocessExpression(rhs);
      const compiled = math.parse(cleaned);
      this.variableFnMap[variable] = (_state, t, helpers) => {
        // console.debug(JSON.stringify(_state) + ' ' + t + ' ' + JSON.stringify(helpers)); 
        return compiled.evaluate({ ..._state, ...helpers, t });
      }
      return;
    }

    // Compile scalar helper
    const cleaned = this.preprocessExpression(rhs);
    const compiled = math.parse(cleaned);
    this.helperFnMap[lhs] = (state, t, helpers) => {
      return compiled.evaluate({ ...state, ...helpers, t }); // ALWAYS returns a number
    };
    this.helperDependencies[lhs] = this.extractDependencies(rhs);
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
}