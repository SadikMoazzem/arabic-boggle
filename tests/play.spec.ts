import { expect, test } from '@playwright/test';
import { cellCenter, drawPath, findAllWords, findOneWord, readGrid } from './helpers';

const PLAY_URL = '/play?d=90&m=3';

async function waitForReady(page: import('@playwright/test').Page) {
  // Wait through the 3-2-1 countdown and any dict/grid load. Once the game
  // is actually playable, the placeholder switches to "Drag to form a word".
  await expect(page.locator('.current-word')).toContainText('Drag to form a word', {
    timeout: 15_000,
  });
}

test.describe('Play screen', () => {
  test('renders 16 cells, timer, and zero score', async ({ page }) => {
    await page.goto(PLAY_URL);
    await waitForReady(page);

    const cells = page.locator('[data-cell-idx]');
    await expect(cells).toHaveCount(16);

    // Every cell shows exactly one Arabic letter
    const letters = await readGrid(page);
    expect(letters).toHaveLength(16);
    for (const l of letters) {
      expect(l).toMatch(/^[ء-ي]$/);
    }

    await expect(page.locator('.timer')).toHaveText(/^1?:\d{2}$/);
    await expect(page.locator('.score')).toContainText('0');
  });

  test('dragging two adjacent cells builds a two-letter current word', async ({ page }) => {
    await page.goto(PLAY_URL);
    await waitForReady(page);
    const letters = await readGrid(page);

    // Cells 0 and 1 are always adjacent (same row).
    const a = await cellCenter(page, 0);
    const b = await cellCenter(page, 1);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });

    await expect(page.locator('.current-word')).toHaveText(letters[0] + letters[1]);
    await expect(page.locator('[data-cell-idx="0"]')).toHaveClass(/on-path/);
    await expect(page.locator('[data-cell-idx="1"]')).toHaveClass(/on-path/);

    // Release ends the gesture; word is too short → rejection toast.
    await page.mouse.up();
    await expect(page.locator('.toast')).toContainText('Need 3+ letters');
  });

  test('non-adjacent cell is ignored mid-drag', async ({ page }) => {
    await page.goto(PLAY_URL);
    await waitForReady(page);
    const letters = await readGrid(page);

    // Cells 0 and 8 are two rows apart (not adjacent). Jump directly with no
    // interpolation so we don't accidentally walk through cell 4 along the way.
    const a = await cellCenter(page, 0);
    const far = await cellCenter(page, 8);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(far.x, far.y, { steps: 1 });

    // Path should still be just cell 0 — only that letter shows.
    await expect(page.locator('.current-word')).toHaveText(letters[0]);
    await expect(page.locator('[data-cell-idx="8"]')).not.toHaveClass(/on-path/);
    await page.mouse.up();
  });

  test('valid word from dictionary is added to the found list and scores', async ({ page }, testInfo) => {
    // Random board generation can sometimes produce a board with no findable
    // word; retry a few times so the test is robust against bad rolls.
    let success = false;
    for (let attempt = 0; attempt < 5 && !success; attempt++) {
      await page.goto(PLAY_URL);
      await waitForReady(page);
      const grid = await readGrid(page);
      const hit = findOneWord(grid, 3);
      if (!hit) continue;

      await testInfo.attach('grid', { body: grid.join(' '), contentType: 'text/plain' });
      await testInfo.attach('chosen-word', {
        body: `${hit.word} via path ${hit.path.join(',')}`,
        contentType: 'text/plain',
      });

      await drawPath(page, hit.path);

      // Score should reflect the word's points; the chip carries the word text.
      await expect(page.locator('.found-list .found-chip').first()).toContainText(hit.word, {
        timeout: 5_000,
      });
      const scoreText = await page.locator('.score').innerText();
      expect(Number(scoreText.replace(/\D/g, ''))).toBeGreaterThan(0);
      success = true;
    }
    expect(success, 'no findable word on any of the random grids tried').toBe(true);
  });

  test('duplicate submission of an already-found word is rejected', async ({ page }) => {
    let attempted = false;
    for (let attempt = 0; attempt < 5 && !attempted; attempt++) {
      await page.goto(PLAY_URL);
      await waitForReady(page);
      const grid = await readGrid(page);
      const hit = findOneWord(grid, 3);
      if (!hit) continue;

      await drawPath(page, hit.path);
      await expect(page.locator('.found-chip').first()).toContainText(hit.word);

      // Submit the same word again on the same path.
      await drawPath(page, hit.path);
      await expect(page.locator('.toast')).toContainText('Already found');
      attempted = true;
    }
    expect(attempted, 'no valid word to test duplicate logic with').toBe(true);
  });

  test('timer reaches zero → end screen keeps the grid and shows score', async ({ page }) => {
    // Install clock before navigation so both the 3s countdown and the 90s
    // game timer can be advanced under our control.
    await page.clock.install();
    await page.goto(PLAY_URL);

    // Wait for grid + dict to load (real time, not faked).
    await expect(page.locator('.countdown-overlay')).toBeVisible({ timeout: 10_000 });
    await page.clock.runFor(4_000);
    await waitForReady(page);

    const grid = await readGrid(page);
    const all = findAllWords(grid, 3);

    await page.clock.runFor(91_000);

    // Header switches to "Time's up" (in the current-word slot).
    await expect(page.locator('.current-word')).toContainText("Time's up", { timeout: 5_000 });
    await expect(page.locator('.end-score')).toBeVisible();
    await expect(page.getByText(/^Your words/)).toBeVisible();
    await expect(page.getByText(/^Top \d+ missed/)).toBeVisible();

    // Grid is still rendered after game over.
    await expect(page.locator('[data-cell-idx]')).toHaveCount(16);

    // The longest findable word should be traced on the grid (visible cells
    // with the 'traced' class).
    if (all.size > 0) {
      const longestLen = Math.max(...[...all].map(w => [...w].length));
      await expect(page.locator('.cell.traced')).toHaveCount(longestLen, { timeout: 5_000 });
    }

    // Missed list overlaps with the solver's full solution set.
    if (all.size > 0) {
      const missedChips = await page
        .locator('.found-list')
        .last()
        .locator('.found-chip')
        .allInnerTexts();
      const missedWords = missedChips.map(t => t.split(' ')[0]);
      const overlap = missedWords.filter(w => all.has(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  test('countdown overlay appears at the start and disappears when play begins', async ({ page }) => {
    await page.goto(PLAY_URL);
    // The overlay should be visible while we're in the countdown phase.
    await expect(page.locator('.countdown-overlay')).toBeVisible({ timeout: 5_000 });
    // After the countdown, the overlay is gone and the grid is interactive.
    await waitForReady(page);
    await expect(page.locator('.countdown-overlay')).toHaveCount(0);
  });
});
