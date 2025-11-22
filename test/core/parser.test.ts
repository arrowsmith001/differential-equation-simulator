import { System } from "@/core/system";
import { describe, it, expect } from "vitest";

describe("parseSystem", () => {
    it("recognises dependent variables from a differential system", () => {
        const system = new System([{ sanitized: "dy/dt=1" }, { sanitized: "dx/dt=2" }]);
        expect(system).toBeDefined();
        expect(system.getVariables()).toEqual(["x", "y"]);
    });

    it("parses a simple time-based system", () => {
        const system = new System([{ sanitized: "dy/dt=-x" }, { sanitized: "dx/dt=y" }]);
        expect(system).toBeDefined();
        expect(system.getVariables()).toEqual(["x", "y"]);
    });

    it("compiles and evaluates expressions correctly", () => {
        const system = new System([{ sanitized: "dy/dt = -x" }, { sanitized: "dx/dt = y" }], { x: 1, y: 0 });
        const result = system.evaluateDerivatives();
        expect(result["x"]).toBe(0); // dx/dt = y = 0
        expect(result["y"]).toBe(-1); // dy/dt = -x = -1
    });

    it("supports more than two variables", () => {
        const system = new System([{ sanitized: "dx/dt = y" }, { sanitized: "dy/dt = z" }, { sanitized: "dz/dt = -x" }], { x: 1, y: 0, z: 0 });
        expect(system.getVariables()).toEqual(["x", "y", "z"]);
        const result = system.evaluateDerivatives();
        expect(result["x"]).toBe(0); // dx/dt = y = 0
        expect(result["y"]).toBe(0); // dy/dt = z = 0
        expect(result["z"]).toBe(-1); // dz/dt = -x = -1
    });

    it("supports use of t", () => {
        const system = new System([{ sanitized: "dx/dt = t" }, { sanitized: "dy/dt = x" }], { x: 0, y: 0 }, 2);
        const result = system.evaluateDerivatives(); // at t=2
        expect(result["x"]).toBe(2); // dx/dt = t = 2
        expect(result["y"]).toBe(0); // dy/dt = x = 0
    });

    it("supports fractions", () => {
        const system = new System([{ sanitized: "dy/dt=-(1)/(2)x" }, { sanitized: "dx/dt=y" }], { x: 1, y: 2 });
        const result = system.evaluateDerivatives();
        expect(result["x"]).toBe(2); // dx/dt = y = 2
        expect(result["y"]).toBe(-0.5); // dy/dt = -(1/2)x = -(1/2)*1 = -0.5

    });

    it("handles aliases", () => {
        const system = new System([{ sanitized: "a = x + y" }, { sanitized: "dy/dt = -a" }, { sanitized: "dx/dt = y" }], { x: 1, y: 2 });
        expect(system.getVariables()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-3); // -a = -(x + y) = -(1 + 2) = -3
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });

    it("handles simple nested aliases", () => {
        const system = new System([{ sanitized: "a = x + y" }, { sanitized: "b = a" }, { sanitized: "c = b" }, { sanitized: "dy/dt = -c" }, { sanitized: "dx/dt = y" }], { x: 1, y: 2 });
        expect(system.getVariables()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-3); // -c = -b = -a = -(x + y) = -(1 + 2) = -3
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });

    it("handles complex nested aliases", () => {
        const system = new System([{ sanitized: "a = x + y" }, { sanitized: "b = a * 2" }, { sanitized: "c = b - y" }, { sanitized: "dy/dt = -c" }, { sanitized: "dx/dt = y" }], { x: 1, y: 2 });
        expect(system.getVariables().sort()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-4); // -c = -4
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });
    it("handles complex nested aliases regardless of order", () => {
        const system = new System([{ sanitized: "a = x + y" }, { sanitized: "b = a * 2" }, { sanitized: "c = b - y" }, { sanitized: "dy/dt = -c" }, { sanitized: "dx/dt = y" }].reverse(), { x: 1, y: 2 });
        expect(system.getVariables().sort()).toEqual(["x", "y"]);
        expect(system.evaluateVar("y")).toBe(-4); // -c = -4
        expect(system.evaluateVar("x")).toBe(2);  // y = 2
    });
});

describe("parseSystem - vector syntax", () => {
    it("parses and evaluates vector derivatives correctly", () => {

        const system = new System([{ sanitized: "(d((x,y,z)))/(d t) = ((y,-x,x+y))"}], { x: 1, y: 2, z: 3 });

        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });

    it("parses vectors with square brackets", () => {
        const system = new System([{ sanitized: "(d[[x,y,z]])/(dt) = [[y,-x,x+y]]"}], { x: 1, y: 2, z: 3 });

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
        const system = new System([{ sanitized: "((y,-x,x+y)) = (d((x,y,z)))/(d t)"}], { x: 1, y: 2, z: 3 });

        expect(system.getVariables().sort()).toEqual(["x", "y", "z"]);

        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });


    it("handles vector aliases in a differential", () => {
        const system = new System([{ sanitized: "r = ((x,y,z))"}, { sanitized: "dr/dt = ((y,-x,x+y))"}], { x: 1, y: 2, z: 3 });

        // expect(system.getVariables().sort()).toEqual(["r"]);

        // Evaluate derivatives
        const x = system.evaluateVar("x");
        const y = system.evaluateVar("y");
        const z = system.evaluateVar("z");

        expect(x).toBe(2);
        expect(y).toBe(-1);
        expect(z).toBe(3);
    });
});
