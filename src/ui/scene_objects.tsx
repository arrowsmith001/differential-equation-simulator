import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SceneCallbacks } from "./scene";

// export interface SceneObjectCallbacks {
//     onStartPointPositionChanged?: (event: Partial<THREE.Vector3>) => void;
// }

export class SceneObjects {

    private cb: SceneCallbacks;

    public container: HTMLElement;
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public controls: OrbitControls;
    public guideGrid: THREE.GridHelper;
    public axes: THREE.AxesHelper;
    public trajectoryLine: THREE.Line;
    public guideLine: THREE.Line;
    public startPoint: THREE.Mesh;
    public endPoint: THREE.Mesh;

    public render() {
        this.renderer.render(this.scene, this.camera);
    }

    constructor(container: HTMLElement, cb: SceneCallbacks) {

        this.cb = cb;

        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = this.initCamera();
        this.renderer = this.initRenderer();
        this.controls = this.initControls();
        this.axes = this.initAxes();
        this.trajectoryLine = this.initTrajectoryLine();
        this.startPoint = this.initStartPoint();
        this.endPoint = this.initEndPoint();
        this.guideGrid = this.initGrid();
        this.guideLine = this.initGuideLine();

        this.renderer.domElement.addEventListener("pointerdown", (e) => this.onPointerDown(e));
        this.renderer.domElement.addEventListener("pointermove", (e) => this.onPointerMove(e));
        window.addEventListener("pointerup", (e) => this.onPointerUp(e));


        // constantly resize scene
        requestAnimationFrame(this.animate);
    }

    // Helper variables
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private plane = new THREE.Plane();
    private planeIntersect = new THREE.Vector3();

    // State variables
    private isDragging = false;
    private dragOffset = new THREE.Vector3();
    private lockedAxes = { x: false, y: false, z: false };


    private animate = () => {
        this.controls.update();

        let targetWidth = this.container.clientWidth;
        let targetHeight = this.container.clientHeight;
        const tol = 1; // px tolerance

        const rect = this.container.getBoundingClientRect();
        targetWidth = rect.width;
        targetHeight = rect.height;

        // interpolate the canvas size toward target for smooth effect
        const currentWidth = this.renderer.domElement.width;
        const currentHeight = this.renderer.domElement.height;

        const newWidth = Math.ceil(currentWidth + (targetWidth - currentWidth) * 0.15);
        const newHeight = Math.ceil(currentHeight + (targetHeight - currentHeight) * 0.15);

        // TODO: there is still a disconnect between the plot and container at the corners
        // outerElement!.style.width = `${newWidth}px`;
        // outerElement!.style.height = `${newHeight}px`;
        // innerElement!.style.width = `${newWidth}px`;
        // innerElement!.style.height = `${newHeight}px`;
        this.renderer.setSize(newWidth, newHeight, true);

        this.camera.aspect = newWidth / newHeight;
        this.camera.updateProjectionMatrix();

        this.render();

        requestAnimationFrame(this.animate);
    }

    private updateMousePosition(event: PointerEvent) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }


    private onPointerDown(e: PointerEvent): void {

        this.updateMousePosition(e);

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObject(this.startPoint, false);

        if (hits.length > 0) {
            this.handlePointDragStart(e)
        }

        // TODO: constraint visuals
        // if (isDragging) {
        //   fadeGrid(gridHelper, 0.5);
        //   fadeLine(guideLine.material, 0.5);
        // }
    }

    private handlePointDragStart(e: PointerEvent) {
        this.isDragging = true;
        this.controls.enabled = false;

        // plane: perpendicular to camera, passing through sphere center
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        this.plane.setFromNormalAndCoplanarPoint(camDir, this.startPoint.position);

        // compute offset from intersection point to sphere center
        if (this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect)) {
            this.dragOffset.copy(this.planeIntersect).sub(this.startPoint.position);
        }

        // capture pointer for smoother dragging
        (e.target as Element).setPointerCapture?.((e as PointerEvent).pointerId);
    }

    private onPointerMove(e: PointerEvent) {

        this.updateMousePosition(e);

        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Hover detection
        const intersects = this.raycaster.intersectObject(this.startPoint, false);
        const hit = intersects.length > 0;

        if (hit || this.isDragging) {
            this.renderer.domElement.style.cursor = "grab";
        } else {
            this.renderer.domElement.style.cursor = "default";
        }

        // Dragging
        if (!this.isDragging) return;

        // const lockedToXy = !lockedAxes.x && !lockedAxes.y && lockedAxes.z;
        // const lockedToYz = lockedAxes.x && !lockedAxes.y && !lockedAxes.z;
        // const lockedToXz = !lockedAxes.x && lockedAxes.y && !lockedAxes.z;

        // // locked to single lines
        // const lockedToX = !lockedAxes.x && lockedAxes.y && lockedAxes.z;
        // const lockedToY = lockedAxes.x && !lockedAxes.y && lockedAxes.z;
        // const lockedToZ = lockedAxes.x && lockedAxes.y && !lockedAxes.z;

        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        this.plane.setFromNormalAndCoplanarPoint(camDir, this.startPoint.position);

        // const lineLocked = lockedToX || lockedToY || lockedToZ;
        // const planeLocked = lockedToXy || lockedToXz || lockedToYz;

        // if (!dragStarted) {
        //     dragStarted = true;
        //     // if (planeLocked) fadeGrid(gridHelper, 0.5);
        //     // if (lineLocked) fadeLine(guideLine.material, 0.5);
        // }

        // use locked information and project plane accordingly
        // gridHelper.visible = false;
        // guideLine.visible = false;
        // if (lockedToXy) {
        //     plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), startPoint.position);
        //     gridHelper.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        //     gridHelper.visible = true;
        // } else if (lockedToYz) {
        //     plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), startPoint.position);
        //     gridHelper.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        //     gridHelper.visible = true;
        // } else if (lockedToXz) {
        //     plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), startPoint.position);
        //     gridHelper.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 0), Math.PI / 2);
        //     gridHelper.visible = true;
        // } else if (lockedToX) {
        //     guideLine.setRotationFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        //     guideLine.visible = true;
        // } else if (lockedToY) {
        //     guideLine.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        //     guideLine.visible = true;
        // } else if (lockedToZ) {
        //     guideLine.setRotationFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        //     guideLine.visible = true;
        // }


        if (this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect)) {
            const newPos = this.planeIntersect.clone().sub(this.dragOffset);

            console.debug('newPos:' + newPos);

            this.startPoint.position.set(
                newPos.x,
                newPos.y,
                newPos.z
            );
            this.renderer.render(this.scene, this.camera);

            if (this.cb.onStartPointPositionChanged) {
                this.cb.onStartPointPositionChanged({
                    x: this.startPoint.position.x,
                    y: this.startPoint.position.y,
                    z: this.startPoint.position.z
                });

            }

        }
    }

    private onPointerUp(event: MouseEvent) {
        this.isDragging = false;
        this.controls.enabled = true;
    }

    private initEndPoint() {
        const currentSphereGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const currentSphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const endPoint = new THREE.Mesh(currentSphereGeo, currentSphereMat);
        this.scene.add(endPoint);
        return endPoint;
    }

    private initStartPoint() {
        const initSphereGeo = new THREE.SphereGeometry(0.1, 16, 16);
        const initSphereMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const startPoint = new THREE.Mesh(initSphereGeo, initSphereMat);
        this.scene.add(startPoint);
        return startPoint;
    }

    private initGuideLine() {
        const guideLineGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-20, 0, 0),
            new THREE.Vector3(20, 0, 0)
        ]);
        const guideLinematerial = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 0.2,
            gapSize: 1,
            transparent: true
        });
        const guideLine = new THREE.Line(guideLineGeometry, guideLinematerial);
        guideLine.visible = false;
        this.scene.add(guideLine);
        return guideLine;
    }

    private initTrajectoryLine() {
        const geometry = new THREE.BufferGeometry();
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        return line;
    }

    private initCamera() {
        const camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        camera.position.set(5, 5, 5);
        return camera;
    }

    private initRenderer() {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(renderer.domElement);
        return renderer;
    }

    private initControls() {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        return controls;
    }

    private initGrid() {
        const gridHelper = new THREE.GridHelper(20, 20);
        gridHelper.material.opacity = 0.0;
        gridHelper.material.transparent = true;
        gridHelper.visible = false;
        this.scene.add(gridHelper);
        return gridHelper;
    }

    private initAxes() {
        const axes = new THREE.AxesHelper(10);
        this.scene.add(axes);
        return axes;
    }
}