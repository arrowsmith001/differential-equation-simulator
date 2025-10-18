import { DifferentialSystem, parseSystem, State } from "@/core/parser";
import { describe, it, expect } from "vitest";


describe("parseSystem", () => {
  it("recognises dependent variables from a differential system", () => {
    const system = parseSystem("dy/dt=1; dx/dt=2");
    expect(system).toBeDefined();
    expect(system.variables.sort()).toEqual(["x", "y"]);
  });

  it("parses a simple time-based system", () => {
    const system = parseSystem("dy/dt=-x; dx/dt=y");
    expect(system).toBeDefined();
    expect(system.variables.sort()).toEqual(["x", "y"]);
  });

  it("compiles and evaluates expressions correctly", () => {
    const system = parseSystem("dy/dt = -x; dx/dt = y");
    const xResult = system.derivatives['x']({ x: 0, y: 1 }, 0);
    const yResult = system.derivatives['y']({ x: 1, y: 0 }, 0);
    expect(xResult).toBe(1);
    expect(yResult).toBe(-1);
  });

  it("supports more than two variables", () => {
    const system = parseSystem("dx/dt = y; dy/dt = z; dz/dt = -x");
    expect(system.variables.sort()).toEqual(["x", "y", "z"]);
    expect(system.derivatives['x']({ x: 1, y: 2, z: 3 }, 0)).toBe(2);
    expect(system.derivatives['y']({ x: 1, y: 2, z: 3 }, 0)).toBe(3);
    expect(system.derivatives['z']({ x: 1, y: 2, z: 3 }, 0)).toBe(-1);
  });

  it("is insensitive to semicolon count and spacing", () => {
    const system = parseSystem("dy/dt=-x;;dx/dt=y;");
    expect(system.variables.sort()).toEqual(["x", "y"]);
  });
});

describe("parseSystem - vector syntax", () => {
  it("parses and evaluates vector derivatives correctly", () => {
    const system: DifferentialSystem = parseSystem(
      "d((x,y,z))/dt = ((y,-x,x+y))"
    );

    // Check that variables are detected correctly
    expect(system.variables.sort()).toEqual(["x","y","z"]);

    // Set an initial state
    const state: State = { x: 1, y: 2, z: 3 };
    const t = 0;

    // Evaluate derivatives
    const dxdt = system.derivatives["x"](state, t);
    const dydt = system.derivatives["y"](state, t);
    const dzdt = system.derivatives["z"](state, t);

    expect(dxdt).toBe(2); 
    expect(dydt).toBe(-1); 
    expect(dzdt).toBe(3); 
  });

  it("parses correctly regardless of which side of the equation the vector form is", () => {
    const system: DifferentialSystem = parseSystem(
      "((y,-x,x+y)) = d((x,y,z))/dt"
    );

    // Check that variables are detected correctly
    expect(system.variables.sort()).toEqual(["x","y","z"]);

    // Set an initial state
    const state: State = { x: 1, y: 2, z: 3 };
    const t = 0;

    // Evaluate derivatives
    const dxdt = system.derivatives["x"](state, t);
    const dydt = system.derivatives["y"](state, t);
    const dzdt = system.derivatives["z"](state, t);

    expect(dxdt).toBe(2); 
    expect(dydt).toBe(-1); 
    expect(dzdt).toBe(3); 
  });
});
