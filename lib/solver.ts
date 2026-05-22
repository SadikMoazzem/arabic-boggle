import { TrieNode } from './dictionary';
import { neighbors } from './path';

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
