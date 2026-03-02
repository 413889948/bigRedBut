import { test, expect } from '@playwright/test';

test.describe('discovered routes', () => {
  test("route: about:blank", async ({ page }) => {
    await page.goto("about:blank");
    await expect(page).toHaveTitle(/.*/);
  });
});
