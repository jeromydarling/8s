import { test, expect } from "@playwright/test";

// App activation + persistence path. Creates a throwaway account and proves the
// big pre-mortem fix: signed-in actions persist across a reload (not just React
// state). Gated behind RUN_AUTH=1 so smoke runs don't create users on prod.

const RUN = process.env.RUN_AUTH === "1";

test.describe("accounts + persistence", () => {
  test.skip(!RUN, "set RUN_AUTH=1 to exercise signup/persistence");

  test("signup → add horse persists across reload", async ({ page }) => {
    const email = `e2e+${Date.now()}@8s.rodeo`;
    const password = "rodeo-test-8s!";

    await page.goto("/app");

    // Open auth via the in-app "Sign in" control.
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // The modal defaults to signup. Fill it.
    await page.getByPlaceholder(/jane rider/i).fill("E2E Tester");
    await page.getByPlaceholder(/you@ranch.com/i).fill(email);
    await page.getByPlaceholder(/at least 8 characters/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    // Account chip (first initial) should appear once signed in.
    await expect(page.getByText(/E2E Tester|confirm your email/i).first()).toBeVisible({ timeout: 15000 });

    // Go to the Tack room and add a horse.
    await page.goto("/app/tack");
    await page.getByRole("button", { name: /add a horse/i }).click();
    await page.getByPlaceholder(/barn name/i).fill("Smoke");
    await page.getByRole("button", { name: /save horse/i }).click();
    await expect(page.getByText("Smoke").first()).toBeVisible();

    // The real test: reload — it must come back from D1, not local state.
    await page.reload();
    await page.goto("/app/tack");
    await expect(page.getByText("Smoke").first()).toBeVisible({ timeout: 15000 });
  });

  test("enter an event persists to the watchlist", async ({ page }) => {
    const email = `e2e+${Date.now()}-w@8s.rodeo`;
    await page.goto("/app");
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.getByPlaceholder(/you@ranch.com/i).fill(email);
    await page.getByPlaceholder(/at least 8 characters/i).fill("rodeo-test-8s!");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/confirm your email|E2E/i).first()).toBeVisible({ timeout: 15000 });

    await page.goto("/app/draw");
    const enter = page.getByRole("button", { name: /^enter$/i }).first();
    await enter.click();
    await expect(page.getByRole("button", { name: /entered/i }).first()).toBeVisible();

    await page.reload();
    await page.goto("/app/draw");
    await expect(page.getByRole("button", { name: /entered/i }).first()).toBeVisible({ timeout: 15000 });
  });
});

// Auth-error path runs always (no account created).
test("login with bad credentials shows an error", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /already have an account/i }).click();
  await page.getByPlaceholder(/you@ranch.com/i).fill("nobody@nowhere.test");
  await page.getByPlaceholder(/password|at least 8/i).first().fill("wrongpassword");
  await page.getByRole("button", { name: /sign in/i }).last().click();
  await expect(page.getByText(/wrong email or password|invalid/i)).toBeVisible({ timeout: 10000 });
});
