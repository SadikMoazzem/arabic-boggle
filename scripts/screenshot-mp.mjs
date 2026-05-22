import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:3100';
const OUT = path.resolve('screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctxA = await browser.newContext({ ...devices['Pixel 5'] });
const ctxB = await browser.newContext({ ...devices['Pixel 5'] });
const host = await ctxA.newPage();
const joiner = await ctxB.newPage();

// Host creates a room.
await host.goto(`${BASE}/room/new`);
await host.getByRole('button', { name: 'Create room' }).click();
await host.waitForURL(/\/room\/[A-Z2-9]{5}$/);
const code = host.url().split('/').pop();
console.log('room code:', code);
await host.getByLabel('Your nickname').fill('Sadik');
await host.getByRole('button', { name: 'Continue' }).click();
await host.locator('.host-badge').waitFor({ timeout: 10_000 });

// Joiner joins by code.
await joiner.goto(`${BASE}/room/join`);
await joiner.getByLabel('Room code').fill(code);
await joiner.getByRole('button', { name: 'Join' }).click();
await joiner.getByLabel('Your nickname').fill('Yara');
await joiner.getByRole('button', { name: 'Continue' }).click();
await host.getByText('Players (2)').waitFor({ timeout: 10_000 });
await joiner.getByText('Players (2)').waitFor({ timeout: 10_000 });

// Screenshot the host's lobby view (with 2 players).
await host.screenshot({ path: path.join(OUT, 'mp-1-lobby-host.png') });
console.log('captured lobby (host with 2 players)');

await joiner.screenshot({ path: path.join(OUT, 'mp-2-lobby-joiner.png') });
console.log('captured lobby (joiner)');

// Host starts a 60s round, both clients enter play.
await host.getByRole('button', { name: '60' }).click();
await host.getByRole('button', { name: 'Start round' }).click();
await host.locator('.current-word:has-text("Drag")').waitFor({ timeout: 10_000 });
await joiner.locator('.current-word:has-text("Drag")').waitFor({ timeout: 10_000 });

// Read the grid from host and submit one valid word.
const grid = await host.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('[data-cell-idx]'));
  cells.sort((a, b) => Number(a.dataset.cellIdx) - Number(b.dataset.cellIdx));
  return cells.map(el => el.textContent.trim());
});

// Inline solver to find a word.
const NORM = { 'أ':'ا','إ':'ا','آ':'ا','ة':'ه','ى':'ي','ؤ':'و','ئ':'ي','ء':'','ً':'','ٌ':'','ٍ':'','َ':'','ُ':'','ِ':'','ّ':'','ْ':'','ـ':'' };
const BASE_SET = new Set(['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي']);
function normalize(s) {
  let o = ''; for (const ch of s) { const n = NORM[ch] !== undefined ? NORM[ch] : ch; if (n === '' || BASE_SET.has(n)) o += n; } return o;
}
const words = JSON.parse(fs.readFileSync('public/dict/ar-words.json', 'utf-8'));
const dict = new Set();
for (const w of words) { const n = normalize(w); if (n.length >= 2) dict.add(n); }
function neighbors(i, s = 4) {
  const r = Math.floor(i/s), c = i%s, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue; const nr = r+dr, nc = c+dc;
    if (nr >= 0 && nr < s && nc >= 0 && nc < s) out.push(nr*s+nc);
  } return out;
}
function find(grid) {
  const used = new Array(grid.length).fill(false);
  let result = null;
  function dfs(i, pre, p) {
    used[i] = true;
    const w = pre + grid[i];
    const np = [...p, i];
    if (w.length >= 3 && dict.has(w) && (!result || w.length > result.word.length)) {
      result = { word: w, path: np };
    }
    if (w.length < 8) {
      for (const nb of neighbors(i)) if (!used[nb]) dfs(nb, w, np);
    }
    used[i] = false;
  }
  for (let i = 0; i < grid.length; i++) dfs(i, '', []);
  return result;
}
const hit = find(grid);
console.log('grid:', grid.join(' '), '| host plays:', hit?.word);

if (hit) {
  async function drawPath(page, p) {
    const boxes = await Promise.all(p.map(i => page.locator(`[data-cell-idx="${i}"]`).boundingBox()));
    await page.mouse.move(boxes[0].x + boxes[0].width / 2, boxes[0].y + boxes[0].height / 2);
    await page.mouse.down();
    for (let i = 1; i < boxes.length; i++) {
      await page.mouse.move(boxes[i].x + boxes[i].width / 2, boxes[i].y + boxes[i].height / 2, { steps: 4 });
    }
    await page.mouse.up();
  }
  await drawPath(host, hit.path);
  await host.waitForTimeout(500);
}

await host.screenshot({ path: path.join(OUT, 'mp-3-play-host.png') });
console.log('captured play (host after submit)');

await joiner.screenshot({ path: path.join(OUT, 'mp-4-play-joiner.png') });
console.log('captured play (joiner sees host scored)');

await browser.close();
console.log('done — multiplayer screenshots in', OUT);
