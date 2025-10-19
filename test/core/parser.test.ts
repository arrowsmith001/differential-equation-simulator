import { DifferentialSystem, State, System } from "@/core/parser";
import { describe, it, expect } from "vitest";

describe("parseSystem", () => {
    it("recognises dependent variables from a differential system", () => {
        const system = new System(["dy/dt=1", "dx/dt=2"]);
        expect(system).toBeDefined();
        expect(system.getVariables()).toEqual(["x", "y"]);
    });

    it("parses a simple time-based system", () => {
        const system = new System(["dy/dt=-x", "dx/dt=y"]);
        expect(system).toBeDefined();
        expect(system.getVariables()).toEqual(["x", "y"]);
    });

    it("compiles and evaluates expressions correctly", () => {
        const system = new System(["dy/dt = -x", "dx/dt = y"], { x: 1, y: 0 });
        const result = system.evaluateAll();
        expect(result["x"]).toBe(0); // dx/dt = y = 0
        expect(result["y"]).toBe(-1); // dy/dt = -x = -1
    });

    it("supports more than two variables", () => {
        const system = new System(["dx/dt = y", "dy/dt = z", "dz/dt = -x"], { x: 1, y: 0, z: 0 });
        expect(system.getVariables()).toEqual(["x", "y", "z"]);
        const result = system.evaluateAll();
        expect(result["x"]).toBe(0); // dx/dt = y = 0
        expect(result["y"]).toBe(0); // dy/dt = z = 0
        expect(result["z"]).toBe(-1); // dz/dt = -x = -1
    });

    it("supports use of t", () => {
        const system = new System(["dx/dt = t", "dy/dt = x"], { x: 0, y: 0 }, 2);
        const result = system.evaluateAll(); // at t=2
        expect(result["x"]).toBe(2); // dx/dt = t = 2
        expect(result["y"]).toBe(0); // dy/dt = x = 0

        system.setState(result, 3);
        const result2 = system.evaluateAll(); // at t=3
        expect(result2["x"]).toBe(3); // dx/dt = t = 3
        expect(result2["y"]).toBe(2); // dy/dt = x = 2 (from previous step)
    });

    it("supports fractions", () => {
        const system = new System(["dy/dt=-(1)/(2)x", "dx/dt=y"], { x: 1, y: 2 });
        const result = system.evaluateAll();
        expect(result["x"]).toBe(2); // dx/dt = y = 2
        expect(result["y"]).toBe(-0.5); // dy/dt = -(1/2)x = -(1/2)*1 = -0.5

    });


    it("handles aliases", () => {
        const system = new System(["a = x + y", "dy/dt = -a", "dx/dt = y"], { x: 1, y: 2 });
        expect(system.getVariables()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-3); // -a = -(x + y) = -(1 + 2) = -3
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });

    it("handles simple nested aliases", () => {
        const system = new System(["a = x + y", "b = a", "c = b", "dy/dt = -c", "dx/dt = y"], { x: 1, y: 2 });
        expect(system.getVariables()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-3); // -c = -b = -a = -(x + y) = -(1 + 2) = -3
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });

    it("handles complex nested aliases", () => {
        const system = new System(["a = x + y", "b = a * 2", "c = b - y", "dy/dt = -c", "dx/dt = y"], { x: 1, y: 2 });
        expect(system.getVariables().sort()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-4); // -c = -4
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });
    it("handles complex nested aliases regardless of order", () => {
        const system = new System(["a = x + y", "b = a * 2", "c = b - y", "dy/dt = -c", "dx/dt = y"].reverse(), { x: 1, y: 2 });
        expect(system.getVariables().sort()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-4); // -c = -4
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });
});

describe("parseSystem - vector syntax", () => {
    it("parses and evaluates vector derivatives correctly", () => {

        const system = new System(["d((x,y,z))/dt = ((y,-x,x+y))"], { x: 1, y: 2, z: 3 });

        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });

    it("parses vectors with square brackets", () => {
        const system = new System(["d[[x,y,z]]/dt = [[y,-x,x+y]]"], { x: 1, y: 2, z: 3 });

        // Check that variables are detected correctly
        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        // Evaluate derivatives
        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");
        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });

    it("parses correctly regardless of which side of the equation the vector form is", () => {
        const system = new System(["((y,-x,x+y)) = d((x,y,z))/dt"], { x: 1, y: 2, z: 3 });

        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });


    it("handles vector aliases in a differential", () => {
        const system = new System(["r = ((x,y,z))", "dr/dt = ((y,-x,x+y))"], { x: 1, y: 2, z: 3 });

        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        // Evaluate derivatives
        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });
});
