import { expect, test } from '@playwright/test';

test.describe('Setup screen', () => {
  test('renders title, defaults, and start button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'بوغل العربي' })).toBeVisible();

    // Default duration = 90, default min length = 3
    await expect(page.getByRole('button', { name: '90' })).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: '3', exact: true })).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: 'ابدأ' })).toBeVisible();
  });

  test('selecting a different duration updates the active state', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '180' }).click();
    await expect(page.getByRole('button', { name: '180' })).toHaveClass(/active/);
    await expect(page.getByRole('button', { name: '90' })).not.toHaveClass(/active/);
  });

  test('start button navigates to /play with chosen params', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '60' }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: 'ابدأ' }).click();
    await expect(page).toHaveURL(/\/play\?d=60&m=4/);
  });
});
