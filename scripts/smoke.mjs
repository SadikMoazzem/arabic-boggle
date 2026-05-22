// Quick smoke test: load the wordlist, build the trie, solve a few boards.
import fs from 'node:fs';
import path from 'node:path';

// Inline minimal versions of normalize/solver to avoid TS toolchain.
const NORM = {
  'أ':'ا','إ':'ا','آ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي','ء':'',
  'ً':'','ٌ':'','ٍ':'','َ':'','ُ':'','ِ':'','ّ':'','ْ':'','ـ':'',
};
const BASE = new Set(['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي']);
function normalize(s) {
  let o = '';
  for (const ch of s) {
    const n = NORM[ch] !== undefined ? NORM[ch] : ch;
    if (n === '' || BASE.has(n)) o += n;
  }
  return o;
}

function neighbors(idx, size = 4) {
  const r = Math.floor(idx / size), c = idx % size;
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) out.push(nr * size + nc);
    }
  return out;
}

class Trie {
  constructor() { this.children = new Map(); this.isWord = false; }
  insert(w) {
    let n = this;
    for (const ch of w) {
      if (!n.children.has(ch)) n.children.set(ch, new Trie());
      n = n.children.get(ch);
    }
    n.isWord = true;
  }
}

function solve(grid, trie, minLength = 3) {
  const found = new Set();
  const used = new Array(grid.length).fill(false);
  function dfs(i, node, prefix) {
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

const raw = JSON.parse(fs.readFileSync(path.resolve('public/dict/ar-words.json'), 'utf-8'));
const trie = new Trie();
const set = new Set();
let dupes = 0;
for (const w of raw) {
  const n = normalize(w);
  if (n.length >= 2) {
    if (set.has(n)) { dupes++; continue; }
    set.add(n);
    trie.insert(n);
  }
}
console.log(`Loaded ${raw.length} raw words → ${set.size} unique normalized (${dupes} duplicates).`);

// Hand-crafted grid known to contain common words.
const grid1 = [
  'ا','ل','ك','ت',
  'م','د','ر','س',
  'ه','ب','ي','ع',
  'ن','و','ر','ج',
];
const found1 = solve(grid1, trie, 3);
console.log(`Grid 1 (designed): ${found1.size} words`);
console.log([...found1].sort((a, b) => b.length - a.length).slice(0, 20).join(', '));

// Random grids using the weighted generator.
import('./gen.mjs').then(({ generateGrid }) => {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const g = generateGrid();
    const f = solve(g, trie, 3);
    total += f.size;
    console.log(`Random ${i + 1}: [${g.join(' ')}] → ${f.size} words` +
      (f.size ? ` (${[...f].slice(0, 5).join(', ')}...)` : ''));
  }
  console.log(`Average findable per random grid: ${(total / 5).toFixed(1)}`);
});
