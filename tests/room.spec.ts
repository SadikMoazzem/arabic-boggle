import { expect, test } from '@playwright/test';

test.describe('Room routes (Stage 1: UI scaffolding)', () => {
  test('Start a room → generates a code and lands in the lobby', async ({ page }) => {
    await page.goto('/room/new');
    await expect(page.getByRole('heading', { name: 'Start a room' })).toBeVisible();
    await page.getByRole('button', { name: 'Create room' }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z2-9]{5}$/);
    await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  });

  test('Lobby prompts for nickname, then shows QR + member list', async ({ page }) => {
    await page.goto('/room/new');
    await page.getByRole('button', { name: 'Create room' }).click();
    // First visit: nickname prompt.
    const nameInput = page.getByLabel('Your nickname');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Tester');
    await page.getByRole('button', { name: 'Continue' }).click();
    // After setting a nickname: QR card + member list + host badge.
    await expect(page.locator('.qr-wrap svg')).toBeVisible();
    await expect(page.getByText(/^Players \(1\)$/)).toBeVisible();
    await expect(page.locator('.host-badge')).toContainText('Host');
    await expect(page.locator('.nickname')).toContainText('Tester');
  });

  test('Join room: input is normalized, button disabled until 5 chars', async ({ page }) => {
    await page.goto('/room/join');
    const input = page.getByLabel('Room code');
    const joinBtn = page.getByRole('button', { name: 'Join' });
    await expect(joinBtn).toBeDisabled();

    // Lowercase + vowels are filtered. maxLength=5 on the input means we
    // need to stay <= 5 chars so the test sees what normalize did.
    await input.fill('aBcDe');
    await expect(input).toHaveValue('BCD');
    await expect(joinBtn).toBeDisabled();

    await input.fill('BCDFG');
    await expect(input).toHaveValue('BCDFG');
    await expect(joinBtn).toBeEnabled();

    await joinBtn.click();
    await expect(page).toHaveURL(/\/room\/BCDFG$/);
  });

  test('Invalid room code path shows recovery UI', async ({ page }) => {
    await page.goto('/room/abc');
    await expect(page.getByRole('heading', { name: 'Invalid room code' })).toBeVisible();
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page).toHaveURL(/\/room\/join$/);
  });
});
