export function neighbors(idx: number, size = 4): number[] {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        out.push(nr * size + nc);
      }
    }
  }
  return out;
}

export function isAdjacent(a: number, b: number, size = 4): boolean {
  if (a === b) return false;
  const ar = Math.floor(a / size);
  const ac = a % size;
  const br = Math.floor(b / size);
  const bc = b % size;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
}

export function isValidPath(path: number[], size = 4): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    if (seen.has(path[i])) return false;
    seen.add(path[i]);
    if (i > 0 && !isAdjacent(path[i - 1], path[i], size)) return false;
  }
  return true;
}

export function pathToWord(path: number[], grid: string[]): string {
  return path.map(i => grid[i]).join('');
}
