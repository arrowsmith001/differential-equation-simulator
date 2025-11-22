import { State } from "@/core/parser";
import { Expression } from "@/core/system";
import { SystemCallbacks } from "@/main";
import { MathfieldElement } from "mathlive";

function normalizeInput(expr: string): string {
    console.debug('Raw input: ' + expr);
    const out = expr
        // Convert things like (d y)/(d t) or ( d y )/( d t ) → dy/dt
        .replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*([A-Za-z_]\w*)\s*\)/g, 'd$1/d$2')
        .replace(/log\s*_\s*([A-Za-z0-9]+)\s*([A-Za-z0-9]+)/g, "log($2, $1)")
        // adds explicit multiplicatioin sign after fractions e.g. ")/(2)x" -> ")/(2)*x"
        .replace(/(\)\s*\/\s*\(\d+\))([A-Za-z])/g, "$1*$2");
    console.debug('Sanitised: ' + out);
    return out;
}

export class ControlPanel {

    private element: HTMLElement;

    private equations: MathfieldElement[];
    private initConditions: { [key: string]: HTMLInputElement } = {};

    constructor(container: HTMLElement, cb: SystemCallbacks) {
        this.element = container;

        this.initConditions = this.createInitialConditionUI();
        this.equations = this.createEquationUI();

        for (const [v, input] of Object.entries(this.initConditions)) {
            input.addEventListener('change', (e) => {
                const target = e.target as HTMLInputElement;
                const value = parseFloat(target.value);
                console.debug(v + ' ' + value);
                if (cb.onInitialConditionsChanged) cb.onInitialConditionsChanged({[v]: value} );
            });
        }

        for (const field of this.equations) {
            field.addEventListener('input', (_) => {
                const newSystem = this.getSantisedEquations();
                if (cb.onSystemChanged) cb.onSystemChanged(newSystem);
            });
        }
    }


    public setExpressionsInUi(exprs: Expression[]) {
       this.equations.forEach((f, i) => {
           f.value = exprs[i].latex ?? '';
       });
    }

    public getSantisedEquations(): Expression[] {
        return this.equations.map((f) => {
            return {
                latex: f.getValue('latex'),
                asciiMath: f.getValue('ascii-math'),
                sanitized: normalizeInput(f.getValue('ascii-math'))
            };
        }).filter(Boolean);
    }
    private createEquationUI() {
        const fields: MathfieldElement[] = [
            document.getElementById("eq1") as MathfieldElement,
            document.getElementById("eq2") as MathfieldElement,
            document.getElementById("eq3") as MathfieldElement,
            document.getElementById("eq4") as MathfieldElement,
            document.getElementById("eq5") as MathfieldElement,
            document.getElementById("eq6") as MathfieldElement,
        ];
        console.debug("Raw input: " + fields.map(f => "\"" + f.getValue('latex').replaceAll("\\", "\\\\") + "\"").join(","))
        return fields;
    }


    inputRawEquations(rawExpr: string[]) {
        for (let i = 0; i < rawExpr.length; i++) {
            this.equations[i].setValue(rawExpr[i]);
        }
    }

    private createInitialConditionUI() {
        this.element.innerHTML = "";

        const inputs: { [key: string]: HTMLInputElement } = {};

        for (const v of ['t', 'x', 'y', 'z']) {

            const wrapper = document.createElement("div");
            wrapper.style.display = "flex";
            wrapper.style.alignItems = "center";
            wrapper.style.gap = "8px";

            const label = document.createElement("label");
            label.textContent = `${v}₀:`;
            label.style.width = "20px";

            const input = document.createElement("input");
            input.type = "number";
            input.step = "any";
            input.value = "0";
            input.dataset.var = v;
            input.style.width = "80px";

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            this.element.appendChild(wrapper);

            inputs[v] = input;
        }

        return inputs;
    }

    public updateInitialConditionsUI(state?: State, t?: number) {


        const time = this.initConditions['t'];
        if(time && t) time!.value = t.toFixed(2);
        
        for (const v in state) {
            const input = this.initConditions[v];
            if (input) {
                if (state[v] !== undefined) input.value = state[v]?.toFixed(2);
            }
        }
    }

    public updateVariables(variables: String[]) {
        // for(const [k,v] of Object.entries(this.initConditions)) {
        //         v.disabled = !variables.includes(k);
        // }
    }


}