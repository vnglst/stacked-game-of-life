# 3D Game of Life

## Overview
3D visualization of Conway's Game of Life in the browser. The current generation sits on top as a normal 2D grid. Each time the simulation steps, the previous generation sinks down to form a history layer below. 8 history layers are shown, each fading in opacity (1.0 → 0.05) and color (bright green → deep blue/violet). The result looks like a glowing 3D stack of time-sliced generations when viewed from a fixed isometric camera.

## Tech Stack
TypeScript + Vite + Three.js

## Running
```bash
npm install && npm run dev
```
Opens at http://localhost:5173

## File Structure
```
3d-game-of-life/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── types.ts        — shared interfaces
    ├── GameOfLife.ts   — simulation logic + ring buffer history
    ├── Renderer3D.ts   — Three.js scene, InstancedMeshes, camera
    └── main.ts         — wires everything, animation loop, buttons
```

## Key Config (main.ts)
```typescript
const CONFIG = {
  GRID_SIZE: 40,
  HISTORY_LAYERS: 8,       // total layers = 9 (1 active + 8 history)
  LAYER_SPACING: 1.5,      // Y-distance between layers
  CELL_W: 0.8, CELL_H: 0.15, CELL_D: 0.8,
  STEP_INTERVAL_MS: 150,
  ACTIVE_COLOR: 0x00ff44,
  FADED_COLOR: 0x3319e6,
  BACKGROUND_COLOR: 0x0d0d0d,
}
```

## Architecture

### GameOfLife.ts
- `grid: Uint8Array` — flat row-major, 1=alive, 0=dead
- `ring: Uint8Array[]` — pre-allocated ring buffer of 8 snapshots
- `head: number` — next write position in ring
- `filledCount: number` — how many history slots are populated (starts at 0)
- `generation: number` — incremented each step, displayed in UI
- `step()` — copies current grid into ring[head], advances head, allocates new `Uint8Array` for next gen using toroidal wrap: `(x + size) % size`
- `getHistory(i)` — returns snapshot i steps ago (0 = most recent), null if not enough history yet
- `randomize()` — 35% density, clears history
- `reset()` — all zeros, clears history

### Renderer3D.ts
- One `InstancedMesh` per layer (9 total), shared `BoxGeometry`
- Per-layer `MeshBasicMaterial` with lerped color + opacity
- Layer color: lerp t = i/(totalLayers-1); RGB lerp from `#00ff44` → `#3319e6`; opacity lerp 1.0 → 0.05
- History layers: `transparent: true`, `depthWrite: false` (prevents z-fighting)
- Active layer: `transparent: false`, `depthWrite: true`
- Camera: `PerspectiveCamera(45)`, position `(gc+50, 50, gc+50)`, lookAt `(gc, stackMidY, gc)` where `gc = 19.5`, `stackMidY = -6.0`
- `updateLayer(i, grid)` — sets instance matrices for alive cells, updates `mesh.count` and `instanceMatrix.needsUpdate`
- `onResize()` — updates camera aspect and renderer size on window resize

### main.ts
- Time-accumulated stepping: accumulate `dt` each rAF tick, step when `>= STEP_INTERVAL_MS`
- `syncRender()` — calls `renderer.updateFromGame(current, getHistory)`, `renderer.render()`, and updates gen counter text
- Reset/Randomize buttons reset `accumulated = 0` and call `syncRender()` immediately
- Generation counter in top-right corner
- `window.gameOfLife` exposes `{ game, renderer, config, animId }` for debugging

## UI
- Two buttons (Reset, Randomize) centered at bottom with glassmorphism style
- Generation counter top-right
- Full-screen canvas, dark `#0d0d0d` background

## Three.js Notes
- `renderer.sortObjects = true` sorts transparent meshes back-to-front by Y — correct behavior
- `depthWrite: false` on history layers prevents occlusion artifacts
- Shared `BoxGeometry` uploaded to GPU once
- `instanceMatrix.needsUpdate = true` only after `step()`, not every frame
