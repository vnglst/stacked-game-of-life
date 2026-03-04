# Game of Life and Ghosts

A 3D visualization of [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) where each generation sinks down into a glowing history stack.

![Stacked Game of Life](https://github.com/user-attachments/assets/13fd4fc1-75ee-4825-b09d-f9513d33feeb)

## Overview

The current generation sits on top; each step the previous generation sinks down into a history stack below. 8 history layers fade in opacity and color giving a glowing 3D time-slice effect from a fixed isometric camera.

## Features

- **3D History Stack**: Watch generations accumulate into a glowing vertical timeline
- **Interactive Controls**: Click cells to toggle their state
- **Pause/Resume**: Control the simulation speed
- **Isometric View**: Fixed camera angle for optimal 3D visualization

## Demo

**[Live Demo →](https://stacked-game-of-life.koenvangilst.nl)**

## Discussion

**[Hacker News →](https://news.ycombinator.com/item?id=47197218)**

## Tech Stack

- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Fast development and building
- [Three.js](https://threejs.org/) - 3D graphics library

## Getting Started

```bash
# Clone the repository
git clone https://github.com/vnglst/stacked-game-of-life.git
cd stacked-game-of-life

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 to view in your browser.

## Controls

- **Click** on a cell to toggle its state (alive/dead)
- **Spacebar** to pause/resume the simulation

## How It Works

### Conway's Game of Life Rules

1. Any live cell with fewer than two live neighbours dies (underpopulation)
2. Any live cell with two or three live neighbours lives on
3. Any live cell with more than three live neighbours dies (overpopulation)
4. Any dead cell with exactly three live neighbours becomes alive (reproduction)

### 3D Visualization

Each generation is rendered as a layer of cubes. As new generations are computed, older layers sink down and fade out, creating a mesmerizing 3D time visualization of the cellular automaton's evolution.

## License

MIT

## Author

[Koen van Gilst](https://koenvangilst.nl)
