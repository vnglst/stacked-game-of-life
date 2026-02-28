export class GameOfLife {
  readonly size: number;
  readonly historySize: number;
  grid: Uint8Array;
  private ring: Uint8Array[];
  private head: number;
  private filledCount: number;
  generation: number;

  constructor(size: number, historySize: number) {
    this.size = size;
    this.historySize = historySize;
    this.grid = new Uint8Array(size * size);
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
    for (const buf of this.ring) buf.fill(0);
  }
}
