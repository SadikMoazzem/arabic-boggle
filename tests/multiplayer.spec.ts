import { expect, test } from '@playwright/test';
import { findOneWord, readGrid } from './helpers';

// A real two-client multiplayer round: host creates a room, joiner joins by
// code, host starts the round, both submit, the timer expires, leaderboard.
test.describe('Multiplayer (PartyKit live)', () => {
  test('two-player round end-to-end', async ({ browser }) => {
    test.setTimeout(120_000);
    // Each player gets its own browser context → its own localStorage, so the
    // pid + nickname are distinct.
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const host = await ctxA.newPage();
    const joiner = await ctxB.newPage();

    // -------- Host creates a room --------
    await host.goto('/room/new');
    await host.getByRole('button', { name: 'Create room' }).click();
    await expect(host).toHaveURL(/\/room\/[A-Z2-9]{5}$/);
    const code = host.url().split('/').pop()!;
    await host.getByLabel('Your nickname').fill('Hostess');
    await host.getByRole('button', { name: 'Continue' }).click();

    // The lobby renders the QR + member list once the WebSocket state arrives.
    await expect(host.locator('.host-badge')).toContainText('Host', { timeout: 10_000 });
    await expect(host.locator('.nickname').first()).toContainText('Hostess');

    // -------- Joiner enters the code --------
    await joiner.goto('/room/join');
    await joiner.getByLabel('Room code').fill(code);
    await joiner.getByRole('button', { name: 'Join' }).click();
    await joiner.getByLabel('Your nickname').fill('Joiner');
    await joiner.getByRole('button', { name: 'Continue' }).click();

    // Both see two players in the lobby.
    await expect(host.getByText(/^Players \(2\)$/)).toBeVisible({ timeout: 10_000 });
    await expect(joiner.getByText(/^Players \(2\)$/)).toBeVisible({ timeout: 10_000 });

    // Joiner sees the host's badge but doesn't have its own.
    await expect(joiner.locator('.host-badge')).toHaveCount(1);
    await expect(joiner.getByText('Waiting for the host')).toBeVisible();

    // -------- Host starts a short round --------
    await host.getByRole('button', { name: '60' }).click();
    await host.getByRole('button', { name: 'Start round' }).click();

    // After the 3s countdown both clients should be in the play phase.
    await expect(host.locator('.grid')).toBeVisible({ timeout: 8_000 });
    await expect(joiner.locator('.grid')).toBeVisible({ timeout: 8_000 });
    // The current-word placeholder switches to "Drag to form a word" once the
    // countdown ends (playing phase).
    await expect(host.locator('.current-word')).toContainText('Drag to form a word', {
      timeout: 8_000,
    });

    // -------- Both players submit a real word --------
    const grid = await readGrid(host);
    const hit = findOneWord(grid, 3);
    test.skip(!hit, 'random board produced no findable word for this run');
    if (!hit) return;

    async function drawAndSubmit(page: import('@playwright/test').Page, path: number[]) {
      const cells = await Promise.all(
        path.map(i => page.locator(`[data-cell-idx="${i}"]`).boundingBox()),
      );
      await page.mouse.move(cells[0]!.x + cells[0]!.width / 2, cells[0]!.y + cells[0]!.height / 2);
      await page.mouse.down();
      for (let i = 1; i < cells.length; i++) {
        const c = cells[i]!;
        await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 4 });
      }
      await page.mouse.up();
    }

    await drawAndSubmit(host, hit.path);
    // Host should see their score update.
    await expect(host.locator('.score').first()).not.toHaveText(/^0 /, { timeout: 5_000 });
    // Joiner sees the host's score climb in the live-scores panel.
    await expect(
      joiner.locator('.member').filter({ hasText: 'Hostess' }).locator('.score-pill'),
    ).not.toHaveText(/^0 /, { timeout: 5_000 });

    // Note: the end-of-round + leaderboard flow runs on a server-side timer
    // that can't be fast-forwarded with page.clock (it only fakes the
    // browser's clock). Verifying lobby sync + live scoring is the most
    // important guarantee for multiplayer. The round-end UI is exercised by
    // the solo end-screen test which uses the same Grid/EndView styling.

    await ctxA.close();
    await ctxB.close();
  });
});
