import test, { expect } from '@playwright/test';

test('Overlay test', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState();
  const isOverlayLinkVisible = await page
    .getByText('Overlay')
    .nth(0)
    .isVisible();
  const isOverlayManagerLinkVisible = await page
    .getByText('Overlay Manager')
    .isVisible();
  expect.soft(isOverlayLinkVisible).toBeTruthy();
  expect.soft(isOverlayManagerLinkVisible).toBeTruthy();
});
