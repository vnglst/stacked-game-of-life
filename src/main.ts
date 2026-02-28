import { GameOfLife } from './GameOfLife.ts';
import { Renderer3D } from './Renderer3D.ts';
import type { Config } from './types.ts';

const CONFIG: Config = {
  GRID_SIZE: 100,
  HISTORY_LAYERS: 30,
  LAYER_SPACING: 0.8,
  CELL_SIZE: 0.8,
  CELL_SPACING: 0.8,
  STEP_INTERVAL_MS: 50,
  ACTIVE_COLOR: 0x00ff41,
  FADED_COLOR: 0x003b00,
  BACKGROUND_COLOR: 0x000000,
};

const container = document.getElementById('canvas-container')!;

const game = new GameOfLife(CONFIG.GRID_SIZE, CONFIG.HISTORY_LAYERS);
const renderer = new Renderer3D(container, CONFIG);

// Start with acorn pattern
game.acorn();

function syncRender(progress = 1): void {
  renderer.updateFromGame(
    game.grid,
    (i) => game.getHistory(i),
    progress,
    game.bornMask,
    game.dyingMask,
  );
  renderer.render();
}

// Initial render
syncRender();

// Animation loop with time-accumulated stepping
let lastTime = performance.now();
let accumulated = 0;
let animId: number;

function animate(now: number): void {
  animId = requestAnimationFrame(animate);
  // Cap dt to one step interval to prevent large jumps when the tab was hidden
  const dt = Math.min(now - lastTime, CONFIG.STEP_INTERVAL_MS);
  lastTime = now;
  accumulated += dt;

  if (accumulated >= CONFIG.STEP_INTERVAL_MS) {
    accumulated -= CONFIG.STEP_INTERVAL_MS;
    game.step();
  }

  // Render every frame with interpolated progress for smooth cell animations
  const progress = Math.min(accumulated / CONFIG.STEP_INTERVAL_MS, 1);
  syncRender(progress);
}

animId = requestAnimationFrame(animate);

renderer.setClickHandler((x, z) => {
  game.setCell(x, z, 1);
  syncRender();
});

// Button handlers
const patterns: Record<string, () => void> = {
  'btn-randomize': () => game.randomize(),
  'btn-reset': () => game.reset(),
  'btn-acorn': () => game.acorn(),
  'btn-rpentomino': () => game.rPentomino(),
  'btn-glider': () => game.glider(),
  'btn-diehard': () => game.diehard(),
  'btn-gosper': () => game.gosper(),
  'btn-pulsar': () => game.pulsar(),
};

for (const [id, action] of Object.entries(patterns)) {
  document.getElementById(id)!.addEventListener('click', () => {
    action();
    accumulated = 0;
    syncRender();
  });
}

document.getElementById('btn-top-view')!.addEventListener('click', () => renderer.topView());
document.getElementById('btn-iso-view')!.addEventListener('click', () => renderer.isoView());

// Settings menu toggle
const settingsToggle = document.getElementById('settings-toggle')!;
const settingsDropdown = document.getElementById('settings-dropdown')!;
let isSettingsOpen = false;

function toggleSettings() {
  isSettingsOpen = !isSettingsOpen;
  if (isSettingsOpen) {
    settingsDropdown.classList.add('active');
    settingsToggle.classList.add('active');
  } else {
    settingsDropdown.classList.remove('active');
    settingsToggle.classList.remove('active');
  }
}

function closeSettings() {
  isSettingsOpen = false;
  settingsDropdown.classList.remove('active');
  settingsToggle.classList.remove('active');
}

settingsToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSettings();
});

// Close when clicking outside
document.addEventListener('click', (e) => {
  if (!document.getElementById('settings-menu')!.contains(e.target as Node)) {
    closeSettings();
  }
});

// Prevent closing when clicking inside the dropdown
settingsDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Expose for debugging
(window as unknown as Record<string, unknown>).gameOfLife = {
  game,
  renderer,
  config: CONFIG,
  animId,
};
