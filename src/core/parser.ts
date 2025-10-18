
import { create, all, MathNode, EvalFunction } from "mathjs";

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
function normalizeDerivatives(input: string): string[] {
  return input
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*t\s*\)/g, "d$1/dt")) // (d y)/(d t) -> dy/dt
    .map(s => s.replace(/[−–—]/g, "-")) // replace unicode minus
    .map(s => s.replace(/\s+/g, "")); // remove whitespace
}

// ---------------------- Main parser ----------------------
export function parseSystem(input: string): DifferentialSystem {
  const eqns = normalizeDerivatives(input);

  if (eqns.length === 0) throw new Error("No valid differential equations were found.");

  type CompiledEquation = { variable: string; fn: EvalFunction };
  const compiled: CompiledEquation[] = [];

  eqns.forEach(eq => {
    const [lhs, rhs] = eq.split("=").map(s => s.trim());
    if (!lhs || !rhs) throw new Error(`Invalid equation: ${eq}`);

    const vectorMatch = lhs.match(/^d\(\(\s*(.+)\s*\)\)\/dt$/)
      || rhs.match(/^d\(\(\s*(.+)\s*\)\)\/dt$/);
    if (vectorMatch) {
      const vars = vectorMatch[1].split(",").map(s => s.trim()); // ["x","y","z"]

      let expressions: string[];
      if (lhs.includes("d((")) {
        // LHS is derivative, RHS is expressions
        const rhsMatch = rhs.match(/^\(\(\s*(.+)\s*\)\)$/);
        if (!rhsMatch) throw new Error("RHS must be a vector");
        expressions = rhsMatch[1].split(",").map(s => s.trim());
      } else {
        // RHS is derivative, LHS is expressions
        const lhsMatch = lhs.match(/^\(\(\s*(.+)\s*\)\)$/);
        if (!lhsMatch) throw new Error("LHS must be a vector");
        expressions = lhsMatch[1].split(",").map(s => s.trim());
      }

      // Compile each variable's derivative
      vars.forEach((v, i) => compiled.push({ variable: v, fn: math.compile(expressions[i]) }));
    }
    else {
      // Extract variable name from LHS like dy/dt
      const match = lhs.match(/^d([A-Za-z_]\w*)\/dt$/);
      if (!match) throw new Error(`Invalid derivative LHS: ${lhs}`);
      const variable = match[1];

      // Compile RHS expression
      const fn = math.compile(rhs);
      compiled.push({ variable, fn });
    }
  });

  // Build derivatives map
  const derivatives: Record<string, (state: State, t: number) => number> = {};
  const initialState: State = {};

  compiled.forEach(({ variable, fn }) => {
    derivatives[variable] = (state: State, t: number) => {
      const scope = { ...state, t };
      return fn.evaluate(scope);
    };
    initialState[variable] = 0; // default initial state
  });

  return {
    variables: compiled.map(c => c.variable),
    indepVar: "t",
    derivatives,
    initialState
  };
}