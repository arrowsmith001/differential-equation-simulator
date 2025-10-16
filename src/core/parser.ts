import { create, all } from "mathjs";
import type { DifferentialSystem } from "./types";

const math = create(all);

export function parseSystem(expr: string): DifferentialSystem {
  // normalize and split
  const raw = expr
    .normalize?.("NFKC") ?? expr; // safe if normalize exists
  const eqns = raw.split(";").map(e => e.trim()).filter(e => e.length > 0);

  const compiled: { varName: string; node: any; compiledFn: any }[] = [];

  for (const e of eqns) {
    const [lhsRaw, rhsRaw] = e.split("=").map(s => s && s.trim());
    if (!lhsRaw || !rhsRaw) throw new Error(`Bad equation: ${String(e)}`);

    // --- CORRECT REGEX: capture variable name after leading 'd' ---
    const match = lhsRaw.match(/^d([A-Za-z_]\w*)\/d[tT]$/);
    if (!match) throw new Error(`Invalid LHS: ${lhsRaw}`);
    const variable = match[1]; // <-- 'x' for 'dx/dt'
    // ------------------------------------------------------------

    // Optionally sanitize rhsRaw for unicode math characters here if needed
    const rhs = rhsRaw; // assume sanitized earlier

    // parse node (for better logging) and compile once
    const node = math.parse(rhs);
    const compiledFn = node.compile();

    console.log("Parsed equation:", { lhs: lhsRaw, variable, rhs });
    console.log("RHS AST (toString):", node.toString());

    compiled.push({ varName: variable, node, compiledFn });
  }

  const variables = compiled.map(c => c.varName);

  return {
    variables,
    fn: (state, t) => {
      const scope = { ...state, t };
      const result: Record<string, number> = {};

      for (const { varName, compiledFn } of compiled) {
        // evaluate exactly once and reuse the numeric value
        const numeric = compiledFn.evaluate(scope);
        if (!isFinite(numeric)) {
          console.warn(`Non-finite derivative for ${varName} with scope:`, scope, "->", numeric);
        }
        // proper key format 'dx/dt'
        const key = `d${varName}/dt`;
        console.log(`EVAL ${key} :=`, numeric);
        result[key] = numeric;
      }
      return result;
    }
  };
}
