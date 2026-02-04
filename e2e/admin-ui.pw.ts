// PocketBun-only: Playwright smoke tests to verify the bundled Admin UI loads.

import { expect, test } from "@playwright/test";

const email = process.env.POCKETBUN_E2E_EMAIL ?? "admin@example.com";
const password = process.env.POCKETBUN_E2E_PASSWORD ?? "change-me";

test("admin UI loads", async ({ page }) => {
  await page.goto("/_/");
  await expect(page).toHaveTitle(/PocketBase/);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});

test("can log in as superuser", async ({ page }) => {
  await page.goto("/_/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.click('form button[type="submit"]');

  await expect(page.getByRole("link", { name: /collections/i })).toBeVisible();
});
