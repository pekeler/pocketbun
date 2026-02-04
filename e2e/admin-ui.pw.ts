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

test("can navigate to collections after login", async ({ page }) => {
  await page.goto("/_/");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.click('form button[type="submit"]');

  const collectionsLink = page.getByRole("link", { name: /collections/i });
  await expect(collectionsLink).toBeVisible();
  await collectionsLink.click();

  await expect(page.getByPlaceholder(/search collections/i)).toBeVisible();
});

test("api health endpoint responds", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body).toEqual({ code: 200, message: "API is healthy.", data: {} });
});
