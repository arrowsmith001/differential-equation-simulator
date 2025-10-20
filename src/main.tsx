import * as THREE from "three";
import 'mathlive';
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { eulerStep } from "./core/integrator";
import type { MathfieldElement } from "mathlive";
import { create, all, type MathNode } from "mathjs";
import { System } from "./core/parser";

const math = create(all);

function initThree(container: HTMLElement) {

  const outerElement = document.getElementById("plot-outer");
  const innerElement = document.getElementById("plot");

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

  // --- persistent objects ---
  // 1. The trajectory line
  let points: THREE.Vector3[] = [];
  let geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  scene.add(line);

  // 2. The initial condition marker (movable)
  const initSphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
  const initSphereMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const initPoint = new THREE.Mesh(initSphereGeo, initSphereMat);
  scene.add(initPoint);

  // 3. (optional) current integration point
  const currentSphereGeo = new THREE.SphereGeometry(0.05, 16, 16);
  const currentSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const currentPoint = new THREE.Mesh(currentSphereGeo, currentSphereMat);
  scene.add(currentPoint);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let isDragging = false;
  let dragOffset = new THREE.Vector3();
  const plane = new THREE.Plane();
  const planeIntersect = new THREE.Vector3();

  // TODO: Minor QOL: visualise locks and projection
  let lockedAxes = { x: false, y: false, z: false };
  let dragCallback: ((pos: { x: number, y: number, z: number }) => void) | undefined;

  function getMouseNDC(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e: PointerEvent) {
    getMouseNDC(e);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(initPoint, false);
    if (hits.length > 0) {
      isDragging = true;
      controls.enabled = false;

      // plane: perpendicular to camera, passing through sphere center
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      plane.setFromNormalAndCoplanarPoint(camDir, initPoint.position);

      // compute offset from intersection point to sphere center
      if (raycaster.ray.intersectPlane(plane, planeIntersect)) {
        dragOffset.copy(planeIntersect).sub(initPoint.position);
      }

      // capture pointer for smoother dragging (optional)
      (e.target as Element).setPointerCapture?.((e as PointerEvent).pointerId);
    }
  }

  let isHoveringInitSphere = false;

  function onPointerMove(e: PointerEvent) {
    getMouseNDC(e);
    raycaster.setFromCamera(mouse, camera);

    // Hover detection
    const intersects = raycaster.intersectObject(initPoint, false);
    if (intersects.length > 0) {
      if (!isHoveringInitSphere) {
        renderer.domElement.style.cursor = "grab";
        isHoveringInitSphere = true;
      }
    } else {
      if (isHoveringInitSphere) {
        renderer.domElement.style.cursor = "default";
        isHoveringInitSphere = false;
      }
    }

    // Dragging
    if (!isDragging) return;
    if (raycaster.ray.intersectPlane(plane, planeIntersect)) {
      const newPos = planeIntersect.clone().sub(dragOffset);
      initPoint.position.set(
        lockedAxes.x ? 0 : newPos.x,
        lockedAxes.y ? 0 : newPos.y,
        lockedAxes.z ? 0 : newPos.z
      );

      // update state/UI
      if (dragCallback) dragCallback({
        x: lockedAxes.x ? 0 : initPoint.position.x,
        y: lockedAxes.y ? 0 : initPoint.position.y,
        z: lockedAxes.z ? 0 : initPoint.position.z
      });
    }
  }

  const onPointerUp = () => {
    if (isDragging) {
      isDragging = false;
      controls.enabled = true;
    }

    const intersects = raycaster.intersectObject(initPoint, false);
    if (intersects.length > 0) {
      if (isHoveringInitSphere) {
        renderer.domElement.style.cursor = "grab";
        isHoveringInitSphere = true;
      }
    } else {
      if (!isHoveringInitSphere) {
        renderer.domElement.style.cursor = "default";
        isHoveringInitSphere = false;
      }
    }
  };

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  // callback storage
  let onDragCallback: ((pos: { x: number; y: number; z: number }) => void) | null = null;


  // initial canvas size
  renderer.setSize(container.clientWidth, container.clientHeight);

  // track target size
  let targetWidth = container.clientWidth;
  let targetHeight = container.clientHeight;
  const tol = 1; // px tolerance

  // animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const rect = container.getBoundingClientRect();
    targetWidth = rect.width;
    targetHeight = rect.height;

    // interpolate the canvas size toward target for smooth effect
    const currentWidth = renderer.domElement.width;
    const currentHeight = renderer.domElement.height;

    const newWidth = Math.ceil(currentWidth + (targetWidth - currentWidth) * 0.15);
    const newHeight = Math.ceil(currentHeight + (targetHeight - currentHeight) * 0.15);

    // TODO: there is still a disconnect between the plot and container at the corners
    // outerElement!.style.width = `${newWidth}px`;
    // outerElement!.style.height = `${newHeight}px`;
    // innerElement!.style.width = `${newWidth}px`;
    // innerElement!.style.height = `${newHeight}px`;
    renderer.setSize(newWidth, newHeight, true);

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  }

  animate();



  return {
    initPoint,

    // called when user changes initial conditions
    setInitialPoint: (x: number, y: number, z: number, axesLocked?: { x?: boolean, y?: boolean, z?: boolean }) => {
      if (axesLocked) lockedAxes = { ...lockedAxes, ...axesLocked };
      initPoint.position.set(
        lockedAxes.x ? 0 : x,
        lockedAxes.y ? 0 : y,
        lockedAxes.z ? 0 : z
      );
    },
    onInitialPointDrag: (cb: (pos: { x: number, y: number, z: number }) => void) => {
      dragCallback = cb;
    },

    // called during integration to append trajectory
    addPoint: (x: number, y: number, z: number) => {
      points.push(new THREE.Vector3(x, y, z));
      if (points.length > 2000) points.shift(); // prevent memory bloat

      geometry.dispose();
      geometry = new THREE.BufferGeometry().setFromPoints(points);
      line.geometry = geometry;

      currentPoint.position.set(x, y, z);
      currentPoint.visible = true;
    },

    // reset trajectory when restarting
    clearPath: () => {
      points = [];
      geometry.dispose();
      geometry = new THREE.BufferGeometry().setFromPoints(points);
      line.geometry = geometry;
      // erase current point
      currentPoint.position.set(0, 0, 0);
      currentPoint.visible = false;

    },
  };
}

/**
 * Small sanitizer for MathLive output and Unicode:
 */
function normalizeInput(expr: string): string {
  return expr
    // Convert things like (d y)/(d t) or ( d y )/( d t ) → dy/dt
    .replace(/\(\s*d\s*([A-Za-z_]\w*)\s*\)\s*\/\s*\(\s*d\s*([A-Za-z_]\w*)\s*\)/g, 'd$1/d$2')
    // remove any spaces and weird minus signs
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, "")
    .replace(/(\)\s*\/\s*\(\d+\))([A-Za-z])/g, "$1*$2") // adds explicit multiplicatioin sign after fractions e.g. ")/(2)x" -> ")/(2)*x"
    // .replace(/(\d|\w|\))(\()/g, '$1*(')  // e.g. "2(x+1)" -> "2*(x+1)"
    // .replace(/(\d|\w|\))([A-Za-z])/g, '$1*$2') // e.g. "2x" or ")x" -> "2*x" or ")*x"
    // .replace(/([A-Za-z])(\d)/g, '$1*$2')
    ; // e.g. "x2" -> "x*2";
}


const form = document.getElementById("initial-form")!;



window.addEventListener("DOMContentLoaded", async () => {
  await customElements.whenDefined("math-field");

  const fields: MathfieldElement[] = [
    document.getElementById("eq1") as MathfieldElement,
    document.getElementById("eq2") as MathfieldElement,
    document.getElementById("eq3") as MathfieldElement,
  ];

  const plotContainer = document.getElementById("plot")!;

  const plot = initThree(plotContainer);

  plot.onInitialPointDrag(({ x, y, z }) => {
    plot.clearPath();
    // update UI fields
    const inputs = document.querySelectorAll<HTMLInputElement>('input[data-var]');
    inputs.forEach((input) => {
      if (input.dataset.var === 'x') input.value = x.toFixed(2);
      if (input.dataset.var === 'y') input.value = y.toFixed(2);
      if (input.dataset.var === 'z') input.value = z.toFixed(2);
    });

    // update simulation state
    state = { ...state, x, y, z };
    if (currentSystem) currentSystem.setState(state, t);
  });

  const form = document.getElementById("initial-form")!;

  /** Build dynamic initial condition inputs based on variable list */
  function createInitialConditionUI(vars: string[]) {
    form.innerHTML = "";

    vars.forEach(v => {
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
      input.value = state[v]?.toString() ?? "0";
      input.dataset.var = v;
      input.style.width = "80px";

      input.addEventListener("input", (e) => updateInitialConditions(vars));

      wrapper.appendChild(label);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });


    updateInitialConditions(vars);
  }

  /** Sync inputs → system state and re-plot initial point */
  function updateInitialConditions(vars: string[]) {
    const inputs = form.querySelectorAll("input[data-var]");
    const newState: Record<string, number> = {};

    inputs.forEach((el) => {
      const input = el as HTMLInputElement;
      const variable = input.dataset.var!;
      newState[variable] = parseFloat(input.value) || 0;
    });

    state = { ...newState };
    t = 0;
    if (currentSystem) currentSystem.setState(state, t);

    // Visualize the starting point (green)
    const x = state.x ?? 0;
    const y = state.y ?? 0;
    const z = state.z ?? 0;

    plot.clearPath();

    plot.setInitialPoint(
      x,
      y,
      z,
      { x: !vars.includes("x"), y: !vars.includes("y"), z: !vars.includes("z") }
    );
  }

  let currentSystem: any;
  let state: Record<string, number> = { x: 0, y: 1, z: 0.5 };
  let t = 0;

  function updateSystem() {
    const expr = fields
      .map((f) => normalizeInput(f.getValue('ascii-math')))
      .filter(Boolean);

    console.debug("Normalized expressions:", expr);

    try {
      currentSystem = new System(expr, state);
      console.debug('Parsed system:', currentSystem);

      // Build the UI when a new system is successfully parsed
      const vars = currentSystem.getVariables();

      createInitialConditionUI(vars);
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
    console.debug("Stepping...");
    if (!currentSystem) return;

    const dt = 0.01;

    for (let i = 0; i < 1000; i++) {
      state = eulerStep(currentSystem, t, dt);
      t += dt;
      currentSystem.setState(state, t);

      const x = state.x ?? 0;
      const y = state.y ?? 0;
      const z = state.z ?? 0;

      plot.addPoint(x, y, z);
    }

    console.debug(`t=${t.toFixed(2)} state:`, state);
  });
});



