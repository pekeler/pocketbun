// PocketBun-only: Playwright smoke tests to verify the bundled Admin UI loads.

import PocketBase from "pocketbase";
import { expect, test, type Page } from "@playwright/test";

const email = process.env.POCKETBUN_E2E_EMAIL ?? "admin@example.com";
const password = process.env.POCKETBUN_E2E_PASSWORD ?? "change-me";
const port = process.env.POCKETBUN_E2E_PORT ?? "8091";
const baseUrl = process.env.POCKETBUN_E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

function passwordInput(page: Page) {
  return page.locator('input[name="password"]');
}

function loginSubmitButton(page: Page) {
  return page.getByRole("button", { name: /^(login|next)$/i });
}

async function loginAsSuperuser(page: Page): Promise<void> {
  await page.goto("/_/");
  await page.getByLabel(/email/i).fill(email);
  await passwordInput(page).fill(password);
  await loginSubmitButton(page).click();
}

test("admin UI loads", async ({ page }) => {
  await page.goto("/_/");
  await expect(page).toHaveTitle(/Superuser login/i);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(passwordInput(page)).toBeVisible();
  await expect(page.getByText(/PocketBun backend/i)).toBeVisible();
});

test("can log in as superuser", async ({ page }) => {
  await loginAsSuperuser(page);

  await expect(page.getByRole("link", { name: /collections/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /^PocketBun$/ })).toBeVisible();
});

test("can navigate to collections after login", async ({ page }) => {
  await loginAsSuperuser(page);

  const collectionsLink = page.getByRole("link", { name: /collections/i });
  await expect(collectionsLink).toBeVisible();
  await collectionsLink.click();

  await expect(page.getByPlaceholder(/search collections/i)).toBeVisible();
});

test("api health endpoint responds", async () => {
  const pb = new PocketBase(baseUrl);
  const health = await pb.health.check();
  expect(health).toEqual({ code: 200, message: "API is healthy.", data: {} });
});
