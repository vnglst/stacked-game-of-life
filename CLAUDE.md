# Game of Life and Ghosts

## Overview

3D visualization of Conway's Game of Life. The current generation sits on top; each step the previous generation sinks down into a history stack below. 8 history layers fade in opacity and color giving a glowing 3D time-slice effect from a fixed isometric camera.

## Tech Stack

TypeScript + Vite + Three.js

## Running

```bash
npm install && npm run dev
```

Opens at http://localhost:5173

## Non-obvious design decisions

**Why `depthWrite: false` on history layers?**
Prevents transparent InstancedMeshes from occluding each other. Combined with `renderer.sortObjects = true` (default), Three.js sorts them back-to-front by Y position, which gives correct transparency stacking.

**Why one InstancedMesh per layer?**
Each layer needs its own material (different color + opacity). InstancedMesh requires a single material, so 9 meshes is the minimum. The `BoxGeometry` is shared across all 9 — uploaded to GPU once.

**Why `instanceMatrix.needsUpdate` only on `step()`, not every rAF frame?**
The matrices don't change between steps, so flagging every frame wastes a GPU upload. Only flag after the game state actually changes.

**Camera math**
`gc = (GRID_SIZE - 1) / 2 = 19.5` (grid center). `stackMidY = -((HISTORY_LAYERS) * LAYER_SPACING) / 2 = -6.0` (vertical midpoint of the stack). Camera at `(gc+50, 50, gc+50)` looking at `(gc, stackMidY, gc)` gives ~35° elevation isometric view.

**Time-accumulated stepping**
`dt` is accumulated each rAF tick and a step fires when it exceeds `STEP_INTERVAL_MS`. This decouples simulation speed from frame rate — the sim runs at a consistent ~6.7 steps/sec regardless of display refresh rate.
