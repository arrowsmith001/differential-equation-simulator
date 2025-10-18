import { useState } from "preact/hooks";
import { parseSystem } from "../core/parser";
import type { DifferentialSystem } from "../core/types";
import { eulerStep } from "../core/integrator";


// TODO: https://chatgpt.com/s/t_68f15a02f1648191b40784ff22ca4abe
export function ExpressionInput() {
  const [expr, setExpr] = useState("dx/dt = y; dy/dt = -x; dz/dt = x + y");
  const [state, setState] = useState<Record<string, number>>({ x:2, y:1 });
  const [sys, setSys] = useState<DifferentialSystem>(() => parseSystem(expr));

  const handleChange = (text: string) => {
    setExpr(text);
    try {
      setSys(parseSystem(text));
      console.log('parsed system: ' + JSON.stringify(sys));
    } catch (err) {
      console.error("Parse error:", err);
    }
  };

  const step = () => {
    const next = eulerStep(sys, state, 0, 0.01);
    setState(next);
    console.log("New state:", next);
  };

  return (
    <div>
      <input
        value={expr}
        onInput={(e) => handleChange((e.target as HTMLInputElement).value)}
      />
      <button onClick={step}>Step</button>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
}
