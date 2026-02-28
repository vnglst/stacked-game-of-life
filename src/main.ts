import { GameOfLife } from './GameOfLife.ts';
import { Renderer3D } from './Renderer3D.ts';
import type { Config } from './types.ts';

const CONFIG: Config = {
  GRID_SIZE: 40,
  HISTORY_LAYERS: 20,
  LAYER_SPACING: 1.5,
  CELL_W: 0.8,
  CELL_H: 0.8,
  CELL_D: 0.8,
  STEP_INTERVAL_MS: 150,
  ACTIVE_COLOR: 0x00ff44,
  FADED_COLOR: 0x3319e6,
  BACKGROUND_COLOR: 0x0d0d0d,
};

const container = document.getElementById('canvas-container')!;
const genCounter = document.getElementById('generation-counter')!;

const game = new GameOfLife(CONFIG.GRID_SIZE, CONFIG.HISTORY_LAYERS);
const renderer = new Renderer3D(container, CONFIG);

// Start with a random grid
game.randomize();

function syncRender(): void {
  renderer.updateFromGame(game.grid, (i) => game.getHistory(i));
  renderer.render();
  genCounter.textContent = `GEN: ${game.generation}`;
}

// Initial render
syncRender();

// Animation loop with time-accumulated stepping
let lastTime = performance.now();
let accumulated = 0;
let animId: number;

function animate(now: number): void {
  animId = requestAnimationFrame(animate);
  const dt = now - lastTime;
  lastTime = now;
  accumulated += dt;

  if (accumulated >= CONFIG.STEP_INTERVAL_MS) {
    accumulated -= CONFIG.STEP_INTERVAL_MS;
    game.step();
    syncRender();
  } else {
    // Still render every frame so the canvas stays alive
    renderer.render();
  }
}

animId = requestAnimationFrame(animate);

renderer.setClickHandler((x, z) => {
  game.setCell(x, z, 1);
  syncRender();
});

// Button handlers
document.getElementById('btn-randomize')!.addEventListener('click', () => {
  game.randomize();
  accumulated = 0;
  syncRender();
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  game.reset();
  accumulated = 0;
  syncRender();
});

document.getElementById('btn-top-view')!.addEventListener('click', () => renderer.topView());
document.getElementById('btn-iso-view')!.addEventListener('click', () => renderer.isoView());

// Expose for debugging
(window as unknown as Record<string, unknown>).gameOfLife = { game, renderer, config: CONFIG, animId };
