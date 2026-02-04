// PocketBun-only: Playwright smoke tests to verify the bundled Admin UI loads.

import { expect, test } from "@playwright/test";

const email = process.env.POCKETBUN_E2E_EMAIL ?? "admin@example.com";
const password = process.env.POCKETBUN_E2E_PASSWORD ?? "change-me";

test("admin UI loads", async ({ page }) => {
  await page.goto("/_/");
  await expect(page).toHaveTitle(/PocketBase/);
  await expect(page.locator('input[name="identity"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test("can log in as superuser", async ({ page }) => {
  await page.goto("/_/");
  await page.fill('input[name="identity"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('form button[type="submit"]');

  await expect(page.locator('a[aria-label="Collections"]')).toBeVisible();
});
