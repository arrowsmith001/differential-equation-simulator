import { create, all } from "mathjs";
import type { Equation } from "./types";

const math = create(all);

export function parseSystem(expr: string) {
  const eqns = expr
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .split(";")
    .map(e => e.trim())
    .filter(Boolean);

  const compiled: Equation[] = [];

  for (const e of eqns) {
    const [lhsRaw, rhsRaw] = e.split("=").map(s => s.trim());
    if (!lhsRaw || !rhsRaw) throw new Error(`Invalid equation: ${e}`);

    // normalize variable names
    const lhs = lhsRaw.replace(/[𝑥]/g, "x").replace(/[𝑦]/g, "y").replace(/[𝑡]/g, "t");
    const rhs = rhsRaw.replace(/[𝑥]/g, "x").replace(/[𝑦]/g, "y").replace(/[𝑡]/g, "t");

    // Identify derivative term on either side
    const derivativeRegex = /d([A-Za-z_]\w*)\/d[tT]/;

    let derivativeVar: string | undefined;
    let exprStr: string;

    const lhsMatch = lhs.match(derivativeRegex);
    const rhsMatch = rhs.match(derivativeRegex);

    if (lhsMatch) {
      derivativeVar = lhsMatch[1];
      // move all other terms to RHS
      exprStr = `${rhs} - (${lhs.replace(lhsMatch[0], "0")})`;
    } else if (rhsMatch) {
      derivativeVar = rhsMatch[1];
      exprStr = `${lhs} - (${rhs.replace(rhsMatch[0], "0")})`;
    } else {
      // no derivative, just a general expression
      exprStr = `${lhs} - (${rhs})`;
    }

    const fn = math.compile(exprStr);

    compiled.push({ derivativeVar, fn, raw: e });
  }

  const variables = compiled
    .filter(c => c.derivativeVar)
    .map(c => c.derivativeVar!) // non-null
    .filter((v, i, arr) => arr.indexOf(v) === i); // unique

  console.log('variables: ' + JSON.stringify(variables));

  return {
    variables,
    equations: compiled,
    fn: (state: Record<string, number>, t: number) => {
      const scope = { ...state, t };
      const result: Record<string, number> = {};

      for (const eq of compiled) {
        const val = eq.fn.evaluate(scope);
        if (eq.derivativeVar) {
          result[`d${eq.derivativeVar}/dt`] = val;
        } else {
          // general expression; store under raw string for reference
          result[eq.raw] = val;
        }
      }

      return result;
    }
  };
}
