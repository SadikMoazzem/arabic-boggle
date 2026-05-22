import { expect, test } from '@playwright/test';

test.describe('Home', () => {
  test('renders the three CTAs and the header', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Arabic Boggle' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Solo/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start a room/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Join a room/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
  });

  test('Solo CTA navigates to /solo', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Solo/ }).click();
    await expect(page).toHaveURL(/\/solo$/);
    await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible();
  });

  test('header menu opens and exposes navigation', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.getByRole('navigation', { name: 'Main menu' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Solo' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Start a room' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Join a room' })).toBeVisible();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(menu).not.toBeVisible();
  });
});
