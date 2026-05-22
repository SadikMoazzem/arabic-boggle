import { TrieNode } from './dictionary';
import { neighbors } from './path';

export function findWordPath(grid: string[], word: string, size = 4): number[] | null {
  const chars = [...word];
  if (chars.length === 0) return null;
  const used = new Array<boolean>(grid.length).fill(false);

  function dfs(cellIdx: number, charIdx: number, path: number[]): number[] | null {
    if (grid[cellIdx] !== chars[charIdx]) return null;
    const next = [...path, cellIdx];
    if (charIdx === chars.length - 1) return next;
    used[cellIdx] = true;
    for (const nb of neighbors(cellIdx, size)) {
      if (used[nb]) continue;
      const r = dfs(nb, charIdx + 1, next);
      if (r) { used[cellIdx] = false; return r; }
    }
    used[cellIdx] = false;
    return null;
  }

  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === chars[0]) {
      const r = dfs(i, 0, []);
      if (r) return r;
    }
  }
  return null;
}

export function solveBoard(
  grid: string[],
  root: TrieNode,
  minLength: number,
  size = 4,
): Set<string> {
  const found = new Set<string>();
  const n = grid.length;
  const used = new Array<boolean>(n).fill(false);

  function dfs(idx: number, node: TrieNode, prefix: string) {
    const ch = grid[idx];
    const next = node.children.get(ch);
    if (!next) return;
    const word = prefix + ch;
    used[idx] = true;
    if (next.isWord && word.length >= minLength) {
      found.add(word);
    }
    if (next.children.size > 0) {
      for (const nb of neighbors(idx, size)) {
        if (!used[nb]) dfs(nb, next, word);
      }
    }
    used[idx] = false;
  }

  for (let i = 0; i < n; i++) {
    dfs(i, root, '');
  }
  return found;
}
