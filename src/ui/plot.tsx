import * as THREE from "three";
import { State } from "@/core/parser";
import { Scene } from "./scene";
import { SystemCallbacks } from "@/main";

// Idea: https://chatgpt.com/s/t_6909609efc6c8191bc69f75d6f316b68


export class Plot {
  private scene: Scene;
  //private cb: PlotCallbacks = {};

  constructor(container: HTMLElement, cb?: SystemCallbacks) {
    this.scene = new Scene(container, {
      onStartPointPositionChanged: (pos) => {
        if (cb?.onInitialConditionsChanged) cb?.onInitialConditionsChanged({x: pos.x, y: pos.y, z: pos.z });
      }
    });
  }

  public updateStartPoint(state: State): void {
    this.scene.updateStartPoint(state);
  }

  // startPoint?: THREE.Mesh,
  // onInitialPointDrag?: (cb: (pos: { x: number, y: number, z: number }) => void) => void,
  // addPoint?: (x: number, y: number, z: number) => void,
  // clearPath?: () => void,
  // isClear?: () => void,


  // not necessary until I start adding these dynamically
  // setCallbacks(cb: PlotCallbacks) {
  //   this.cb = cb;
  // }

  appendTrajectory(points: State[]) {
    this.scene.appendPointsToLine(points);
  }

  clear() {
    this.scene.clearPlot();
  }

  updateAxesColors(colors: { x: string; y: string; z: string }) {
    // recolor axes
  }

  // // Example: when user drags a marker in 3D space
  // handleMarkerMoved(newPosition: { x: number; y: number; z: number }) {
  //   this.cb.onInitialConditionsChanged?.(newPosition);
  // }

  // // Example: when user edits equation in the UI (if plot has an editor)
  // handleEquationEdited(exprs: string[]) {
  //   this.cb.onEquationChanged?.(exprs);
  // }
}


// export function initThree(container: HTMLElement): Plot {


//   let isDragging = false;

//   let lockedAxes = { x: false, y: false, z: false };
//   let dragCallback: ((pos: { x: number, y: number, z: number }) => void) | undefined;


//   window.addEventListener("pointerup", onPointerUp);


//   // initial canvas size
//   renderer.setSize(container.clientWidth, container.clientHeight);

//   // track target size
//   let targetWidth = container.clientWidth;
//   let targetHeight = container.clientHeight;
//   const tol = 1; // px tolerance

//   // animation loop
//   function animate() {
//     requestAnimationFrame(animate);
//     controls.update();

//     const rect = container.getBoundingClientRect();
//     targetWidth = rect.width;
//     targetHeight = rect.height;

//     // interpolate the canvas size toward target for smooth effect
//     const currentWidth = renderer.domElement.width;
//     const currentHeight = renderer.domElement.height;

//     const newWidth = Math.ceil(currentWidth + (targetWidth - currentWidth) * 0.15);
//     const newHeight = Math.ceil(currentHeight + (targetHeight - currentHeight) * 0.15);

//     // TODO: there is still a disconnect between the plot and container at the corners
//     // outerElement!.style.width = `${newWidth}px`;
//     // outerElement!.style.height = `${newHeight}px`;
//     // innerElement!.style.width = `${newWidth}px`;
//     // innerElement!.style.height = `${newHeight}px`;
//     renderer.setSize(newWidth, newHeight, true);

//     camera.aspect = newWidth / newHeight;
//     camera.updateProjectionMatrix();

//     renderer.render(scene, camera);
//   }

//   animate();

//   function fadeGrid(grid: THREE.GridHelper, targetOpacity: number, duration = 300) {
//     const startOpacity = grid.material.opacity;
//     const startTime = performance.now();

//     function animate() {
//       const now = performance.now();
//       const elapsed = now - startTime;
//       const t = Math.min(elapsed / duration, 1); // 0 → 1

//       // Linear interpolation
//       grid.material.opacity = startOpacity + (targetOpacity - startOpacity) * t;

//       if (t < 1) {
//         requestAnimationFrame(animate);
//       }

//     }

//     animate();
//   }

//   function fadeLine(line: THREE.LineDashedMaterial | THREE.LineBasicMaterial, targetOpacity: number, duration = 500) {

//     const startOpacity = line.opacity;
//     const startTime = performance.now();

//     function animate() {
//       const elapsed = performance.now() - startTime;
//       const t = Math.min(elapsed / duration, 1);
//       line.opacity = startOpacity + (targetOpacity - startOpacity) * t;

//       if (t < 1) requestAnimationFrame(animate);
//     }

//     animate();
//   }

//   return new Plot({

//     // called when user changes initial conditions
//     onInitialPointDrag: (cb: (pos: { x: number, y: number, z: number }) => void) => {
//       dragCallback = cb;
//     },

//     // called during integration to append trajectory
//     addPoint: (x: number, y: number, z: number) => {
//       points.push(new THREE.Vector3(x, y, z));
//       if (points.length > 2000) points.shift(); // prevent memory bloat

//       geometry.dispose();
//       geometry = new THREE.BufferGeometry().setFromPoints(points);
//       line.geometry = geometry;

//       endPoint.position.set(x, y, z);
//       endPoint.visible = true;
//     },

//     // reset trajectory when restarting
//     clearPath: () => {
//       points = [];
//       geometry.dispose();
//       geometry = new THREE.BufferGeometry().setFromPoints(points);
//       line.geometry = geometry;
//       // erase current point
//       endPoint.position.set(0, 0, 0);
//       endPoint.visible = false;

//     },

//     isClear: () => {
//       return points.length == 0;
//     }
//   });
// }