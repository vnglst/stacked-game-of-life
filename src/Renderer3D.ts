import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Config } from './types.ts';

export class Renderer3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private meshes: THREE.InstancedMesh[];
  private geometry: THREE.BoxGeometry;
  private totalLayers: number;
  private config: Config;
  private controls: OrbitControls;
  private dummy = new THREE.Object3D();

  constructor(container: HTMLElement, config: Config) {
    this.config = config;
    this.totalLayers = config.HISTORY_LAYERS + 1;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(config.BACKGROUND_COLOR);
    this.renderer.sortObjects = true;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();

    // Shared geometry
    this.geometry = new THREE.BoxGeometry(config.CELL_W, config.CELL_H, config.CELL_D);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    const gc = (config.GRID_SIZE - 1) / 2; // grid center
    const stackMidY = -((this.totalLayers - 1) * config.LAYER_SPACING) / 2;
    this.camera.position.set(gc + 50, 50, gc + 50);
    this.camera.lookAt(gc, stackMidY, gc);

    // Orbit controls — drag to rotate, scroll to zoom, right-drag to pan
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(gc, stackMidY, gc);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.update();

    // Create one InstancedMesh per layer
    const maxInstances = config.GRID_SIZE * config.GRID_SIZE;
    this.meshes = [];

    for (let i = 0; i < this.totalLayers; i++) {
      const t = this.totalLayers > 1 ? i / (this.totalLayers - 1) : 0;
      const color = this.lerpColor(config.ACTIVE_COLOR, config.FADED_COLOR, t);
      const opacity = 1.0 - t * (1.0 - 0.05);
      const isActive = i === 0;

      const material = new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: !isActive,
        depthWrite: isActive,
      });

      const mesh = new THREE.InstancedMesh(this.geometry, material, maxInstances);
      mesh.count = 0;
      // Y position: active layer at 0, history sinks down
      mesh.position.y = -i * config.LAYER_SPACING;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    // Handle resize
    window.addEventListener('resize', () => this.onResize(container));
  }

  setClickHandler(onCell: (x: number, z: number) => void): void {
    const canvas = this.renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0
    const pointer = new THREE.Vector2();
    const hit = new THREE.Vector3();
    let dragDist = 0;
    let downX = 0;
    let downY = 0;

    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      dragDist = 0;
    });

    canvas.addEventListener('pointermove', (e) => {
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      dragDist = Math.hypot(dx, dy);
    });

    canvas.addEventListener('pointerup', (e) => {
      if (dragDist > 5) return; // ignore drags (orbit control)
      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, this.camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        const x = Math.round(hit.x);
        const z = Math.round(hit.z);
        onCell(x, z);
      }
    });
  }

  private lerpColor(from: number, to: number, t: number): number {
    const fr = (from >> 16) & 0xff;
    const fg = (from >> 8) & 0xff;
    const fb = from & 0xff;
    const tr = (to >> 16) & 0xff;
    const tg = (to >> 8) & 0xff;
    const tb = to & 0xff;
    const r = Math.round(fr + (tr - fr) * t);
    const g = Math.round(fg + (tg - fg) * t);
    const b = Math.round(fb + (tb - fb) * t);
    return (r << 16) | (g << 8) | b;
  }

  updateLayer(layerIndex: number, grid: Uint8Array): void {
    const mesh = this.meshes[layerIndex];
    const size = this.config.GRID_SIZE;
    let count = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y * size + x] === 1) {
          this.dummy.position.set(x, 0, y);
          this.dummy.updateMatrix();
          mesh.setMatrixAt(count, this.dummy.matrix);
          count++;
        }
      }
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  updateFromGame(current: Uint8Array, getHistory: (i: number) => Uint8Array | null): void {
    // Layer 0 = active (current generation)
    this.updateLayer(0, current);

    // Layers 1..HISTORY_LAYERS = history (most recent first)
    for (let i = 1; i < this.totalLayers; i++) {
      const hist = getHistory(i - 1);
      if (hist) {
        this.updateLayer(i, hist);
      } else {
        // No history yet for this slot — hide it
        this.meshes[i].count = 0;
        this.meshes[i].instanceMatrix.needsUpdate = true;
      }
    }
  }

  topView(): void {
    const gc = (this.config.GRID_SIZE - 1) / 2;
    const stackMidY = -((this.totalLayers - 1) * this.config.LAYER_SPACING) / 2;
    this.camera.position.set(gc, stackMidY + 80, gc);
    this.controls.target.set(gc, stackMidY, gc);
    this.controls.update();
  }

  isoView(): void {
    const gc = (this.config.GRID_SIZE - 1) / 2;
    const stackMidY = -((this.totalLayers - 1) * this.config.LAYER_SPACING) / 2;
    this.camera.position.set(gc + 50, 50, gc + 50);
    this.controls.target.set(gc, stackMidY, gc);
    this.controls.update();
  }

  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
