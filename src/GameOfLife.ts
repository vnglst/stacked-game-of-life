export class GameOfLife {
  readonly size: number;
  readonly historySize: number;
  grid: Uint8Array;
  bornMask: Uint8Array;
  dyingMask: Uint8Array;
  private ring: Uint8Array[];
  private head: number;
  private filledCount: number;
  generation: number;

  constructor(size: number, historySize: number) {
    this.size = size;
    this.historySize = historySize;
    this.grid = new Uint8Array(size * size);
    this.bornMask = new Uint8Array(size * size);
    this.dyingMask = new Uint8Array(size * size);
    this.ring = Array.from({ length: historySize }, () => new Uint8Array(size * size));
    this.head = 0;
    this.filledCount = 0;
    this.generation = 0;
  }

  step(): void {
    // Save current grid into ring buffer
    this.ring[this.head].set(this.grid);
    this.head = (this.head + 1) % this.historySize;
    if (this.filledCount < this.historySize) this.filledCount++;

    // Compute next generation in a temp buffer
    const size = this.size;
    const next = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const neighbors = this.countNeighbors(x, y);
        const alive = this.grid[y * size + x] === 1;
        if (alive) {
          next[y * size + x] = neighbors === 2 || neighbors === 3 ? 1 : 0;
        } else {
          next[y * size + x] = neighbors === 3 ? 1 : 0;
        }
      }
    }

    // Track which cells are born or dying this step
    for (let i = 0; i < this.grid.length; i++) {
      const was = this.grid[i];
      const will = next[i];
      this.bornMask[i] = was === 0 && will === 1 ? 1 : 0;
      this.dyingMask[i] = was === 1 && will === 0 ? 1 : 0;
    }

    this.grid = next;
    this.generation++;
  }

  private countNeighbors(x: number, y: number): number {
    const size = this.size;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = (x + dx + size) % size;
        const ny = (y + dy + size) % size;
        count += this.grid[ny * size + nx];
      }
    }
    return count;
  }

  // i=0 → most recent history, i=historySize-1 → oldest
  getHistory(i: number): Uint8Array | null {
    if (i >= this.filledCount) return null;
    // head points to the slot that will be written next,
    // so (head - 1) is the most recent snapshot
    const idx = (this.head - 1 - i + this.historySize * 10) % this.historySize;
    return this.ring[idx];
  }

  setCell(x: number, z: number, value: 0 | 1): void {
    if (x < 0 || x >= this.size || z < 0 || z >= this.size) return;
    this.grid[z * this.size + x] = value;
  }

  acorn(): void {
    this.grid.fill(0);
    this.clearHistory();
    // Acorn pattern (7×3), centered in the grid
    const cells = [
      [1, 0],
      [3, 1],
      [0, 2],
      [1, 2],
      [4, 2],
      [5, 2],
      [6, 2],
    ];
    const ox = Math.floor(this.size / 2) - 3;
    const oy = Math.floor(this.size / 2) - 1;
    for (const [dx, dy] of cells) {
      this.setCell(ox + dx, oy + dy, 1);
    }
  }

  rPentomino(): void {
    this.grid.fill(0);
    this.clearHistory();
    // R-pentomino (3×3), centered in the grid
    const cells = [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ];
    const ox = Math.floor(this.size / 2) - 1;
    const oy = Math.floor(this.size / 2) - 1;
    for (const [dx, dy] of cells) {
      this.setCell(ox + dx, oy + dy, 1);
    }
  }

  randomize(): void {
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < 0.35 ? 1 : 0;
    }
    this.clearHistory();
  }

  reset(): void {
    this.grid.fill(0);
    this.clearHistory();
  }

  private clearHistory(): void {
    this.head = 0;
    this.filledCount = 0;
    this.generation = 0;
    this.bornMask.fill(0);
    this.dyingMask.fill(0);
    for (const buf of this.ring) buf.fill(0);
  }
}
