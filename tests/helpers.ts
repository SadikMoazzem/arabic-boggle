import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

const NORM: Record<string, string> = {
  'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ة': 'ه', 'ى': 'ي', 'ؤ': 'و', 'ئ': 'ي',
  'ء': '', 'ً': '', 'ٌ': '', 'ٍ': '', 'َ': '', 'ُ': '', 'ِ': '', 'ّ': '', 'ْ': '', 'ـ': '',
};
const BASE = new Set([
  'ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف',
  'ق','ك','ل','م','ن','ه','و','ي',
]);

export function normalize(s: string): string {
  let o = '';
  for (const ch of s) {
    const n = ch in NORM ? NORM[ch] : ch;
    if (n === '' || BASE.has(n)) o += n;
  }
  return o;
}

class TrieNode {
  children = new Map<string, TrieNode>();
  isWord = false;
}

let cached: { trie: TrieNode; set: Set<string> } | null = null;

export function getDict(): { trie: TrieNode; set: Set<string> } {
  if (cached) return cached;
  const raw: string[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'public/dict/ar-words.json'), 'utf-8'),
  );
  const trie = new TrieNode();
  const set = new Set<string>();
  for (const w of raw) {
    const n = normalize(w);
    if (n.length < 2 || set.has(n)) continue;
    set.add(n);
    let node = trie;
    for (const ch of n) {
      let next = node.children.get(ch);
      if (!next) {
        next = new TrieNode();
        node.children.set(ch, next);
      }
      node = next;
    }
    node.isWord = true;
  }
  cached = { trie, set };
  return cached;
}

function neighbors(idx: number, size = 4): number[] {
  const r = Math.floor(idx / size);
  const c = idx % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  }
  return out;
}

export function findOneWord(
  grid: string[],
  minLength = 3,
): { word: string; path: number[] } | null {
  const { trie } = getDict();
  const used = new Array(grid.length).fill(false);

  function dfs(i: number, node: TrieNode, prefix: string, p: number[]): { word: string; path: number[] } | null {
    const ch = grid[i];
    const next = node.children.get(ch);
    if (!next) return null;
    used[i] = true;
    const w = prefix + ch;
    const np = [...p, i];
    if (next.isWord && w.length >= minLength) {
      used[i] = false;
      return { word: w, path: np };
    }
    if (next.children.size > 0) {
      for (const nb of neighbors(i)) {
        if (!used[nb]) {
          const r = dfs(nb, next, w, np);
          if (r) { used[i] = false; return r; }
        }
      }
    }
    used[i] = false;
    return null;
  }

  for (let i = 0; i < grid.length; i++) {
    const r = dfs(i, trie, '', []);
    if (r) return r;
  }
  return null;
}

export function findAllWords(grid: string[], minLength = 3): Set<string> {
  const { trie } = getDict();
  const found = new Set<string>();
  const used = new Array(grid.length).fill(false);

  function dfs(i: number, node: TrieNode, prefix: string) {
    const ch = grid[i];
    const next = node.children.get(ch);
    if (!next) return;
    used[i] = true;
    const w = prefix + ch;
    if (next.isWord && w.length >= minLength) found.add(w);
    if (next.children.size > 0) {
      for (const nb of neighbors(i)) if (!used[nb]) dfs(nb, next, w);
    }
    used[i] = false;
  }
  for (let i = 0; i < grid.length; i++) dfs(i, trie, '');
  return found;
}

export async function readGrid(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll<HTMLElement>('[data-cell-idx]'));
    cells.sort(
      (a, b) => Number(a.dataset.cellIdx) - Number(b.dataset.cellIdx),
    );
    return cells.map(el => (el.textContent ?? '').trim());
  });
}

export async function cellCenter(page: Page, idx: number): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-cell-idx="${idx}"]`).boundingBox();
  if (!box) throw new Error(`cell ${idx} has no bounding box`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function drawPath(page: Page, path: number[]) {
  if (path.length === 0) return;
  const first = await cellCenter(page, path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let i = 1; i < path.length; i++) {
    const c = await cellCenter(page, path[i]);
    await page.mouse.move(c.x, c.y, { steps: 4 });
  }
  await page.mouse.up();
}
