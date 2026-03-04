import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  BoxGeometry,
  MeshBasicMaterial,
  InstancedMesh,
  Vector3,
  Vector2,
  Plane,
  Raycaster,
  Spherical,
  Matrix4,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Config } from './types.ts';

export class Renderer3D {
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private meshes: InstancedMesh[] = [];
  private geometry: BoxGeometry;
  private totalLayers: number;
  private config: Config;
  private controls: OrbitControls;
  private gc: number;
  private stackMidY: number;
  private dummy = {
    position: new Vector3(),
    scale: new Vector3(1, 1, 1),
    matrix: new Matrix4(),
  };

  // Cache for history layers - stores grid snapshots to avoid re-processing
  private historyCache: (Uint8Array | null)[] = [];

  // Intro animation state
  private introPhase: 'hold' | 'sweep' | 'orbit' | 'done' = 'hold';
  private introStartTime = performance.now();
  private introStartSpherical!: Spherical;
  private introEndSpherical!: Spherical;
  private static readonly HOLD_DURATION = 3000;
  private static readonly SWEEP_DURATION = 5000;

  constructor(container: HTMLElement, config: Config) {
    this.config = config;
    this.totalLayers = config.HISTORY_LAYERS + 1;

    // Renderer
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(config.BACKGROUND_COLOR);
    this.renderer.sortObjects = true;
    container.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new Scene();

    // Shared geometry
    this.geometry = new BoxGeometry(config.CELL_SIZE, config.CELL_SIZE, config.CELL_SIZE);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new PerspectiveCamera(45, aspect, 0.1, 1000);
    this.gc = ((config.GRID_SIZE - 1) * config.CELL_SPACING) / 2;
    this.stackMidY = -((this.totalLayers - 1) * config.LAYER_SPACING) / 2;
    const gc = this.gc;
    const stackMidY = this.stackMidY;
    this.camera.position.set(gc + 70, 70, gc + 70);
    this.camera.lookAt(gc, stackMidY, gc);

    // Orbit controls — drag to rotate, scroll to zoom, right-drag to pan
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(gc, stackMidY, gc);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // Compute spherical coords for intro start/end relative to orbit target
    // Start: top-down (polar angle ~0, looking straight down)
    // End: isometric (gc+50, 50, gc+50) relative to target
    const isoOffset = new Vector3(70, 70 - stackMidY, 70);
    this.introEndSpherical = new Spherical().setFromVector3(isoOffset);
    // Start: same radius, but nearly straight above (small polar angle)
    this.introStartSpherical = new Spherical(
      80 - stackMidY, // radius (height above target)
      0.01, // phi: nearly top-down (tiny offset avoids gimbal lock)
      this.introEndSpherical.theta, // same azimuth so no horizontal rotation
    );

    // Position camera at intro start
    const startOffset = new Vector3().setFromSpherical(this.introStartSpherical);
    this.camera.position.copy(this.controls.target).add(startOffset);
    this.controls.enabled = false;
    this.controls.update();

    // Cancel intro on any user interaction (capture phase ensures controls.enabled becomes true before OrbitControls handles the event)
    const onInteract = () => this.cancelIntro();
    this.renderer.domElement.addEventListener('pointerdown', onInteract, true);
    this.renderer.domElement.addEventListener('wheel', onInteract, true);

    this.rebuildMeshes(config.GRID_SIZE * config.GRID_SIZE);
    this.resetHistoryCache();

    // Handle resize
    window.addEventListener('resize', () => this.onResize(container));
  }

  setClickHandler(onCell: (x: number, z: number) => void): void {
    const canvas = this.renderer.domElement;
    const raycaster = new Raycaster();
    const plane = new Plane(new Vector3(0, 1, 0), 0); // y = 0
    const pointer = new Vector2();
    const hit = new Vector3();
    let dragDist = 0;
    let isPointerDown = false;

    canvas.addEventListener('pointerdown', (e) => {
      isPointerDown = true;
      dragDist = 0;
      pointer.set(e.clientX, e.clientY);
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isPointerDown) return;
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      dragDist = Math.hypot(dx, dy);
    });

    canvas.addEventListener('pointerup', (e) => {
      isPointerDown = false;
      // Ignore if this was a drag (let OrbitControls handle it)
      if (dragDist > 5) return;

      const rect = canvas.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, this.camera);
      if (raycaster.ray.intersectPlane(plane, hit)) {
        const x = Math.round(hit.x / this.config.CELL_SPACING);
        const z = Math.round(hit.z / this.config.CELL_SPACING);
        onCell(x, z);
      }
    });

    // Reset state if pointer is cancelled
    canvas.addEventListener('pointercancel', () => {
      isPointerDown = false;
      dragDist = 0;
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

  private disposeMeshes(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.dispose();
    }
  }

  private rebuildMeshes(maxInstances: number): void {
    this.meshes = [];
    for (let i = 0; i < this.totalLayers; i++) {
      const t = this.totalLayers > 1 ? i / (this.totalLayers - 1) : 0;
      const color = this.lerpColor(this.config.ACTIVE_COLOR, this.config.FADED_COLOR, t);
      const opacity = 1.0 - t * (1.0 - this.config.MIN_OPACITY);
      const isActive = i === 0;

      const material = new MeshBasicMaterial({
        color,
        opacity,
        transparent: !isActive,
        depthWrite: isActive,
      });

      const mesh = new InstancedMesh(this.geometry, material, maxInstances);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.position.y = -i * this.config.LAYER_SPACING;
      mesh.visible = this.ghostsVisible || isActive;
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  private resetHistoryCache(): void {
    this.historyCache = new Array(this.totalLayers).fill(null);
  }

  updateLayer(
    layerIndex: number,
    grid: Uint8Array,
    progress = 1,
    bornMask?: Uint8Array,
    dyingMask?: Uint8Array,
  ): void {
    const mesh = this.meshes[layerIndex];
    const size = this.config.GRID_SIZE;
    let count = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const alive = grid[i] === 1;
        const born = bornMask?.[i] === 1;
        const dying = dyingMask?.[i] === 1;

        // Include alive cells (current gen) and dying cells (fading out)
        if (!alive && !dying) continue;

        const scale = dying ? 1 - progress : born ? progress : 1;

        this.dummy.position.set(x * this.config.CELL_SPACING, 0, y * this.config.CELL_SPACING);
        this.dummy.scale.set(scale, scale, scale);
        this.dummy.matrix.makeScale(this.dummy.scale.x, this.dummy.scale.y, this.dummy.scale.z);
        this.dummy.matrix.setPosition(this.dummy.position);
        mesh.setMatrixAt(count, this.dummy.matrix);
        count++;
      }
    }

    // Reset dummy scale so history layers (no masks) render at full size
    this.dummy.scale.set(1, 1, 1);

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  updateFromGame(
    current: Uint8Array,
    getHistory: (i: number) => Uint8Array | null,
    progress = 1,
    bornMask?: Uint8Array,
    dyingMask?: Uint8Array,
  ): void {
    // Layer 0 = active (current generation) - always update for animation
    this.updateLayer(0, current, progress, bornMask, dyingMask);

    // Layers 1..HISTORY_LAYERS = history (most recent first)
    // Only update when history data changes (cache miss) for performance
    // Skip if ghosts are hidden
    if (!this.ghostsVisible) return;
    for (let i = 1; i < this.totalLayers; i++) {
      const hist = getHistory(i - 1);
      const cached = this.historyCache[i];

      if (!hist) {
        // No history yet for this slot — hide it
        if (cached !== null) {
          this.meshes[i].count = 0;
          this.meshes[i].instanceMatrix.needsUpdate = true;
          this.historyCache[i] = null;
        }
        continue;
      }

      // Check if history changed (different reference or content)
      if (hist !== cached) {
        this.updateLayer(i, hist);
        this.historyCache[i] = hist;
      }
      // else: same history, skip re-processing
    }
  }

  private cancelIntro(): void {
    if (this.introPhase === 'done') return;
    this.introPhase = 'done';
    this.controls.enabled = true;
    this.controls.autoRotate = false;
  }

  topView(): void {
    this.cancelIntro();
    this.camera.position.set(this.gc, this.stackMidY + 80, this.gc);
    this.controls.target.set(this.gc, this.stackMidY, this.gc);
    this.controls.update();
  }

  isoView(): void {
    this.cancelIntro();
    this.camera.position.set(this.gc + 70, 70, this.gc + 70);
    this.controls.target.set(this.gc, this.stackMidY, this.gc);
    this.controls.update();
  }

  private ghostsVisible = true;

  setGhostsVisible(visible: boolean): void {
    this.ghostsVisible = visible;
    // Toggle visibility of history layers (indices 1+)
    for (let i = 1; i < this.totalLayers; i++) {
      this.meshes[i].visible = visible;
    }
  }

  updateHistoryLayers(historyLayers: number): void {
    this.disposeMeshes();

    // Update config and state
    this.config.HISTORY_LAYERS = historyLayers;
    this.totalLayers = historyLayers + 1;

    // Recalculate stack center
    this.stackMidY = -((this.totalLayers - 1) * this.config.LAYER_SPACING) / 2;

    this.rebuildMeshes(this.config.GRID_SIZE * this.config.GRID_SIZE);
    this.resetHistoryCache();

    // Update camera target
    this.controls.target.set(this.gc, this.stackMidY, this.gc);
    this.controls.update();
  }

  updateMinOpacity(minOpacity: number): void {
    this.config.MIN_OPACITY = minOpacity;

    // Update opacity for all layers
    for (let i = 0; i < this.totalLayers; i++) {
      const t = this.totalLayers > 1 ? i / (this.totalLayers - 1) : 0;
      const opacity = 1.0 - t * (1.0 - minOpacity);
      const isActive = i === 0;

      const material = this.meshes[i].material as MeshBasicMaterial;
      material.opacity = opacity;
      material.transparent = !isActive;
      material.depthWrite = isActive;
      material.needsUpdate = true;
    }
  }

  updateGridSize(newSize: number): void {
    // Update config
    this.config.GRID_SIZE = newSize;

    // Recalculate grid center
    this.gc = ((newSize - 1) * this.config.CELL_SPACING) / 2;

    this.disposeMeshes();
    this.rebuildMeshes(newSize * newSize);
    this.resetHistoryCache();

    // Update camera target and position
    this.controls.target.set(this.gc, this.stackMidY, this.gc);
    this.camera.position.set(this.gc + 70, 70, this.gc + 70);
    this.controls.update();
  }

  render(): void {
    this.updateIntro();
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private updateIntro(): void {
    if (this.introPhase === 'done') return;

    const elapsed = performance.now() - this.introStartTime;

    if (this.introPhase === 'hold') {
      if (elapsed < Renderer3D.HOLD_DURATION) return;
      this.introPhase = 'sweep';
    }

    if (this.introPhase === 'sweep') {
      const sweepElapsed = elapsed - Renderer3D.HOLD_DURATION;
      const t = Math.min(sweepElapsed / Renderer3D.SWEEP_DURATION, 1);

      // Interpolate spherical coordinates for smooth rotation
      const s = this.introStartSpherical;
      const e = this.introEndSpherical;
      const current = new Spherical(
        s.radius + (e.radius - s.radius) * t,
        s.phi + (e.phi - s.phi) * t,
        s.theta + (e.theta - s.theta) * t,
      );
      const offset = new Vector3().setFromSpherical(current);
      this.camera.position.copy(this.controls.target).add(offset);
      this.camera.lookAt(this.controls.target);

      if (t >= 1) {
        this.introPhase = 'orbit';
        this.controls.enabled = true;
        this.controls.autoRotate = true;
      }
    }
  }

  private onResize(container: HTMLElement): void {
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
