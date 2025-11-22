import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SceneObjects } from "./scene_objects";
import { State } from "@/core/parser";

export interface SceneCallbacks {
  onStartPointPositionChanged?: (event: State) => void;
}

export class Scene {
  clearPlot() {
    this.trajectory = [];
    this.objs.trajectoryLine.geometry.dispose();
    this.objs.trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints([]);
    this.objs.endPoint.position.set(0, 0, 0);
  }

  private objs: SceneObjects;
  private trajectory: THREE.Vector3[] = [];

  constructor(container: HTMLElement, cb: SceneCallbacks) {
    this.objs = new SceneObjects(container, cb);
    // TODO: Possible improvement - register specific interest
  }

  public updateStartPoint(point: Partial<THREE.Vector3>) {
    const { x, y, z } = point;
    console.debug('point: ' + JSON.stringify(point));
    const pos = this.objs.startPoint.position;
    this.objs.startPoint.position.set(
      x === undefined ? pos.x : x,
      y === undefined ? pos.y : y,
      z === undefined ? pos.z : z
    );
  }

  public appendPointsToLine(points: State[]) {
    this.trajectory = [...this.trajectory, ...points.map((p) => new THREE.Vector3(p.x, p.y, p.z))].slice(-2000);
    const geometry = new THREE.BufferGeometry().setFromPoints(this.trajectory);
    this.objs.trajectoryLine.geometry = geometry; // Update the reference to the line object
  }
  



}