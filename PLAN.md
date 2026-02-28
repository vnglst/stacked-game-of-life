# Plan: 3D Game of Life

## Context
Build a 3D visualization of Conway's Game of Life in the browser. The current generation sits on top as a normal 2D grid. Each time the simulation steps, the previous generation sinks down to form a history layer below. 8 history layers are shown, each fading in opacity (1.0 → 0.05) and color (bright green → deep blue/violet). The result looks like a glowing 3D stack of time-sliced generations when viewed from a fixed isometric camera.

## Target directory
`/Users/vnglst/Code/3d-game-of-life/` (already exists, currently empty)

## Tech stack
TypeScript + Vite + Three.js — same pattern as `/Users/vnglst/Code/hilbert-curve-zoom/`

## File structure
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

## Key config constants (in main.ts)
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

## GameOfLife.ts
- `grid: Uint8Array` — flat row-major, 1=alive, 0=dead
- `ring: Uint8Array[]` — pre-allocated ring buffer of 8 snapshots
- `head: number` — next write position
- `step()` — copies current into ring[head], advances head, computes next gen in-place using toroidal wrap: `(x + size) % size`
- `getHistory(i)` — returns ring[(head - i + historySize*10) % historySize], or null if not enough history yet
- `randomize()` — 35% density, clears history
- `reset()` — all zeros, clears history

## Renderer3D.ts
- One `InstancedMesh` per layer (9 total), shared `BoxGeometry`
- Per-layer `MeshBasicMaterial` (no lighting needed) with computed color + opacity
- Layer color formula: lerp t = i/(totalLayers-1); r/g/b lerp from `#00ff44` → `#3319e6`; opacity lerp 1.0 → 0.05
- History layer materials: `transparent: true`, `depthWrite: false` (prevents z-fighting)
- Active layer material: `transparent: false`, `depthWrite: true`
- `updateLayer(i, grid)` — sets instance matrices for alive cells only, updates `mesh.count` and `instanceMatrix.needsUpdate`
- `instanceMatrix.needsUpdate` set only on game step (not every rAF frame) — performance win
- Camera: `PerspectiveCamera(45)`, position `(gc+50, 50, gc+50)`, lookAt `(gc, stackMidY, gc)` where `gc = 19.5`, `stackMidY = -6.0` — gives ~35° elevation isometric view

## main.ts
- Time-accumulated stepping: accumulate `dt` each rAF tick, step when `>= STEP_INTERVAL_MS`
- `syncRender()` — calls `renderer.updateFromGame(current, getHistory)` then `renderer.render()`
- Reset/Randomize buttons call `game.reset()` / `game.randomize()` then `syncRender()` immediately
- Generation counter displayed in top-right corner

## index.html
- Two buttons (Reset, Randomize) centered at bottom with glassmorphism style
- Generation counter top-right
- Full-screen canvas container, dark `#0d0d0d` background

## package.json dependencies
```json
{ "three": "^0.160.0" }
{ "@types/three": "^0.160.0", "typescript": "^5.3.3", "vite": "^5.0.12" }
```

## Three.js gotchas
- `renderer.sortObjects = true` (default) sorts transparent InstancedMeshes back-to-front by Y position — correct behavior
- `depthWrite: false` on all history layers prevents them from occluding each other
- Share one `BoxGeometry` across all 9 meshes — uploaded to GPU once
- Set `instanceMatrix.needsUpdate = true` only after `step()`, not every frame

## Verification
1. `cd 3d-game-of-life && npm install && npm run dev`
2. Browser opens at localhost:5173 — 40x40 grid auto-plays with random cells
3. Top layer: bright green cells
4. History layers visible below, fading to blue/violet
5. "Randomize" fills with new random grid; "Reset" clears to empty
6. Fixed isometric view shows full grid top + visible depth
