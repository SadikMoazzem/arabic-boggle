import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

// Inline solver to find a real word + path on the rendered grid.
const NORM = {
  'أ':'ا','إ':'ا','آ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي','ء':'',
  'ً':'','ٌ':'','ٍ':'','َ':'','ُ':'','ِ':'','ّ':'','ْ':'','ـ':'',
};
const BASE_SET = new Set(['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي']);
function normalize(s) {
  let o = ''; for (const ch of s) { const n = NORM[ch] !== undefined ? NORM[ch] : ch; if (n === '' || BASE_SET.has(n)) o += n; } return o;
}
class Trie { constructor() { this.children = new Map(); this.isWord = false; } }
function insert(t, w) { let n = t; for (const c of w) { if (!n.children.has(c)) n.children.set(c, new Trie()); n = n.children.get(c); } n.isWord = true; }
const trie = new Trie();
for (const w of JSON.parse(fs.readFileSync('public/dict/ar-words.json', 'utf-8'))) {
  const n = normalize(w); if (n.length >= 2) insert(trie, n);
}
function neighbors(i, s = 4) {
  const r = Math.floor(i/s), c = i%s, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue; const nr = r+dr, nc = c+dc;
    if (nr >= 0 && nr < s && nc >= 0 && nc < s) out.push(nr*s+nc);
  } return out;
}
function findLongestWord(grid) {
  const used = new Array(grid.length).fill(false);
  let best = null;
  function dfs(i, node, pre, p) {
    const ch = grid[i]; const next = node.children.get(ch); if (!next) return;
    used[i] = true; const w = pre+ch; const np = [...p, i];
    if (next.isWord && w.length >= 3 && (!best || w.length > best.word.length)) best = { word: w, path: np };
    if (next.children.size > 0) for (const nb of neighbors(i)) if (!used[nb]) dfs(nb, next, w, np);
    used[i] = false;
  }
  for (let i = 0; i < grid.length; i++) dfs(i, trie, '', []);
  return best;
}

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 5'] });
const page = await context.newPage();

// 1. Setup
await page.goto(BASE);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: path.join(OUT, '1-setup.png') });
console.log('captured setup');

// 2. Play (empty grid)
await page.goto(`${BASE}/play?d=90&m=3`);
await page.locator('.current-word:has-text("اسحب")').waitFor({ timeout: 10_000 });
await page.screenshot({ path: path.join(OUT, '2-play-empty.png') });
console.log('captured play (empty)');

// 3. Play with a path drawn mid-drag
const grid = await page.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('[data-cell-idx]'));
  cells.sort((a, b) => Number(a.dataset.cellIdx) - Number(b.dataset.cellIdx));
  return cells.map(el => el.textContent.trim());
});
const hit = findLongestWord(grid);
console.log('grid:', grid.join(' '), '| word:', hit?.word);

async function cellCenter(i) {
  const box = await page.locator(`[data-cell-idx="${i}"]`).boundingBox();
  return { x: box.x + box.width/2, y: box.y + box.height/2 };
}

if (hit && hit.path.length >= 3) {
  const first = await cellCenter(hit.path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  // Stop one short so we can screenshot the live path before submit.
  for (let i = 1; i < hit.path.length - 1; i++) {
    const c = await cellCenter(hit.path[i]);
    await page.mouse.move(c.x, c.y, { steps: 4 });
  }
  await page.screenshot({ path: path.join(OUT, '3-play-path.png') });
  console.log('captured play (mid-drag)');
  // Finish the path and submit so we have a found word for the next shot.
  const last = await cellCenter(hit.path[hit.path.length - 1]);
  await page.mouse.move(last.x, last.y, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '4-play-found.png') });
  console.log('captured play (after submit)');
}

// 5. End screen via clock fast-forward — reload to clear toast/flash first.
await page.goto(`${BASE}/play?d=60&m=3`);
await page.locator('.current-word:has-text("اسحب")').waitFor({ timeout: 10_000 });
// Submit one valid word so the end screen has something to show.
const grid2 = await page.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('[data-cell-idx]'));
  cells.sort((a, b) => Number(a.dataset.cellIdx) - Number(b.dataset.cellIdx));
  return cells.map(el => el.textContent.trim());
});
const hit2 = findLongestWord(grid2);
if (hit2 && hit2.path.length >= 3) {
  const first = await cellCenter(hit2.path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let i = 1; i < hit2.path.length; i++) {
    const c = await cellCenter(hit2.path[i]);
    await page.mouse.move(c.x, c.y, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
}
// Wait out the timer naturally — only 60s, but we'll just wait.
// Actually use clock — but we already started. Just call the route after waiting.
// Simpler: navigate with d=2 so the timer ends quickly.
await page.goto(`${BASE}/play?d=10&m=3`);
await page.locator('.current-word:has-text("اسحب")').waitFor({ timeout: 10_000 });
const grid3 = await page.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('[data-cell-idx]'));
  cells.sort((a, b) => Number(a.dataset.cellIdx) - Number(b.dataset.cellIdx));
  return cells.map(el => el.textContent.trim());
});
const hit3 = findLongestWord(grid3);
if (hit3 && hit3.path.length >= 3) {
  const first = await cellCenter(hit3.path[0]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (let i = 1; i < hit3.path.length; i++) {
    const c = await cellCenter(hit3.path[i]);
    await page.mouse.move(c.x, c.y, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}
await page.locator('text=انتهى الوقت!').waitFor({ timeout: 15_000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, '5-end.png'), fullPage: true });
console.log('captured end screen');

await browser.close();
console.log('done — screenshots in', OUT);
