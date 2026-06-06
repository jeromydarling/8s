import { test, expect } from "@playwright/test";

// Negative-path auth checks. The full happy-path journey lives in journey.spec.ts.

test("login with bad credentials shows an error", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /already have an account/i }).click();
  await page.getByPlaceholder(/you@ranch.com/i).fill("nobody@nowhere.test");
  await page.getByPlaceholder(/password|at least 8/i).first().fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).last().click();
  await expect(page.getByText(/wrong email or password|invalid/i)).toBeVisible({ timeout: 10000 });
});
