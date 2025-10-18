import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { parseSystem } from "./core/parser";
import { eulerStep } from "./core/integrator";

// ---------------------- MathLive typing ----------------------
interface MathfieldElement extends HTMLElement {
  value: string;
  getValue(format?: "ascii-math" | "latex" | "math-json"): string;
  setValue(value: string, format?: "ascii-math" | "latex" | "math-json"): void;
}

// ---------------------- Normalize derivatives ----------------------
function normalizeDerivatives(s: string): string {
  return s
    .replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*t\s*\)/g, "d$1/dt")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    ;
}

// ---------------------- Three.js plot ----------------------
function initThree(container: HTMLElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(5, 5, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  scene.add(new THREE.AxesHelper(5));

  const points: THREE.Vector3[] = [];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();


  return {
    addPoint: (x: number, y: number, z: number) => {
      // Add to trajectory line
      points.push(new THREE.Vector3(x, y, z));
      geometry.setFromPoints(points);

      // Add a small sphere at the new point
      const sphereGeo = new THREE.SphereGeometry(0.05, 8, 8); // radius 0.05
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(x, y, z);
      scene.add(sphere);
    },
  };
}


// ---------------------- Main App ----------------------
window.addEventListener("DOMContentLoaded", async () =>   {
  await customElements.whenDefined("math-field");

  const fields: MathfieldElement[] = [
    document.getElementById("eq1") as MathfieldElement,
    document.getElementById("eq2") as MathfieldElement
  ];

  const plotContainer = document.getElementById("plot")!;
  const plot = initThree(plotContainer);

  let currentSystem: any;
  let state: Record<string, number> = {x:0, y: 1, z:0.5};
  let t = 0;

  function updateSystem() {
    const expr = fields
      .map((f) => normalizeDerivatives(f.getValue("ascii-math")))
      .filter(Boolean)
      .join("; ");

    console.log("Normalized expressions:", expr);

    try {
      currentSystem = parseSystem(expr);
      // state = { ...currentSystem.initialState };
      console.log("Parsed system:", currentSystem);
    } catch (err) {
      console.error("Parse error:", err);
    }
  }

  fields.forEach((f) => {
    f.addEventListener("input", updateSystem);
    f.addEventListener("change", updateSystem);
  });

  updateSystem(); // initial parse

  const stepBtn = document.getElementById("stepBtn")!;
  stepBtn.addEventListener("click", () => {
    if (!currentSystem) return;
    const dt = 0.025;
    state = eulerStep(currentSystem, state, t, dt);
    t += dt;

    const x = state.x ?? 0;
    const y = state.y ?? 0;
    const z = state.z ?? 0;

    plot.addPoint(x, y, z);

    console.log(`t=${t.toFixed(2)} state:`, state);
  });
});
