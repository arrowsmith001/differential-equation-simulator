

import { eulerStep } from "@/core/integrator";
import { System } from "@/core/parser";
import { describe, it, expect } from "vitest";

describe("integrator", () => {
    it("integrates a Lorenz system", () => {
        const system = new System([
            "dx/dt=sigma*(y-x)", "dy/dt=x*(rho-z)-y", "dz/dt=x*y-beta*z", "rho=28", "sigma=10", "beta=(8)/(3)"
        ], { x: 1, y: 1, z: 1 });
        expect(system).toBeDefined();

        const dt = 0.01;
        let t = 0;

        const next = eulerStep(system, t, dt);
        expect(next["x"]).toBeCloseTo(1.0 + dt * 0); // dx/dt = 10(1-1) = 0
        expect(next["y"]).toBeCloseTo(1.0 + dt * 26); // dy/dt = 1(28-1)-1 = 26
        expect(next["z"]).toBeCloseTo(1.0 + dt * (-5/3)); // dz/dt = 1*1 - (8/3)*1 = -5/3
    });

    it("integrates a Lorenz system with implicit multiplication", () => {
        const system = new System([
            "dx/dt=sigma(y-x)", "dy/dt=x(rho-z)-y", "dz/dt=x y-beta z", "rho=28", "sigma=10", "beta=(8)/(3)"
        ], { x: 1, y: 1, z: 1 });
        expect(system).toBeDefined();

        const dt = 0.01;
        let t = 0;

        const next = eulerStep(system, t, dt);
        expect(next["x"]).toBeCloseTo(1.0 + dt * 0); // dx/dt = 10(1-1) = 0
        expect(next["y"]).toBeCloseTo(1.0 + dt * 26); // dy/dt = 1(28-1)-1 = 26
        expect(next["z"]).toBeCloseTo(1.0 + dt * (-5/3)); // dz/dt = 1*1 - (8/3)*1 = -5/3
    });

    it("integrates logarithmic function", () => {
        const system = new System(["dx/dt=log_e(x)"], { x: Math.E });

        expect(system).toBeDefined();

        const dt = 0.01;
        let t = 0;

        const next = eulerStep(system, t, dt);
        expect(next["x"]).toBeCloseTo(1.0 + dt * 1); // dx/dt = ln(e) = 1
    })

});
