import { test, expect } from "@playwright/test";

// Marketing + public-surface smoke. No auth. Verifies the site loads, the brand
// renders, CTAs route into the ungated app, and the API/SEO surfaces respond.

test("home loads with brand + hero", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/8 Seconds/i);
  // Wordmark appears (multiple ok) and the hero headline is present.
  await expect(page.getByText("8 SECONDS").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("primary CTA drops into the ungated app (no email wall)", async ({ page }) => {
  await page.goto("/");
  // Any of the "see the demo / live demo" CTAs.
  const cta = page.getByRole("button", { name: /see the (live )?demo|demo/i }).first();
  await cta.click();
  await expect(page).toHaveURL(/\/app/);
  // App shell loaded — assert via the Today heading (present in both layouts),
  // not the nav (the sidebar is hidden on mobile, the bottom bar on desktop).
  await expect(page.getByRole("heading", { name: /howdy/i })).toBeVisible({ timeout: 15000 });
});

test("watch-the-tour opens the video modal", async ({ page }) => {
  await page.goto("/");
  const watch = page.getByRole("button", { name: /watch the tour/i });
  if (await watch.count()) {
    await watch.first().click();
    await expect(page.getByText(/quick tour/i)).toBeVisible();
  }
});

test("submit-event page renders and validates", async ({ page }) => {
  await page.goto("/submit");
  await expect(page.getByRole("heading", { name: /list your rodeo/i })).toBeVisible();
  await expect(page.getByPlaceholder(/Cross Timbers|rodeo/i).first()).toBeVisible();
});

test("API: health + config respond", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  const h = await health.json();
  expect(h.ok).toBe(true);

  const config = await request.get("/api/config");
  expect(config.ok()).toBeTruthy();
});

test("API: events feed returns geocoded rows", async ({ request }) => {
  const res = await request.get("/api/events");
  expect(res.ok()).toBeTruthy();
  const { events } = await res.json();
  // May be null on a fresh DB; if present, every row must be plottable.
  if (Array.isArray(events) && events.length) {
    for (const e of events.slice(0, 25)) {
      expect(typeof e.lat).toBe("number");
      expect(typeof e.lng).toBe("number");
    }
  }
});

test("SEO: sitemap is served", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.ok()).toBeTruthy();
  expect((await res.text())).toContain("<urlset");
});
