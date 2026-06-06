import { test, expect, type Page } from "@playwright/test";

// THE FULL JOURNEY: a brand-new user signs up and does everything the app
// offers — every tab, every interaction — asserting persistence where it counts.
// Runs serially (one shared account). Cleans the test user up at the end.
//
// Always runs (signup verification is off by default). Override the target with
// BASE_URL; the admin token (for cleanup) defaults to the known ART_INGEST_TOKEN.

const TOKEN = process.env.ART_INGEST_TOKEN || "rowel-8s-ingest-a7f3c9e1";
const stamp = Date.now();
const email = `e2e+journey-${stamp}@8s.rodeo`;
const password = "rodeo-test-8s!";
const name = "Journey Tester";

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});

test.afterAll(async ({ request }) => {
  // Tidy D1 so repeated runs don't pile up test accounts.
  await request.post(`/api/admin/purge-user?token=${TOKEN}&email=${encodeURIComponent(email)}`).catch(() => {});
  await page.close();
});

test("1. land on marketing → enter the app", async () => {
  await page.goto("/");
  await expect(page).toHaveTitle(/8 Seconds/i);
  await page.getByRole("button", { name: /see the (live )?demo|demo/i }).first().click();
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("heading", { name: /howdy/i })).toBeVisible({ timeout: 15000 });
});

test("2. sign up as a brand-new user", async () => {
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // Modal defaults to signup.
  await page.getByPlaceholder(/jane rider/i).fill(name);
  await page.getByPlaceholder(/you@ranch.com/i).fill(email);
  await page.getByPlaceholder(/at least 8 characters/i).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  // Signed in: account chip shows the initial; the "Sign in" button is gone.
  await expect(page.getByRole("button", { name: /^sign in$/i })).toHaveCount(0, { timeout: 15000 });
});

test("3. Draw — list, filter, enter an event (persists)", async () => {
  await page.goto("/app/draw");
  await expect(page.getByRole("heading", { name: /every event/i })).toBeVisible();

  // Filter chips.
  await page.getByRole("button", { name: /^Barrels$/ }).click().catch(() => {});
  await page.getByRole("button", { name: /^All$/ }).click().catch(() => {});

  // Enter the first event.
  const enter = page.getByRole("button", { name: /^enter$/i }).first();
  await enter.click();
  await expect(page.getByRole("button", { name: /entered/i }).first()).toBeVisible();

  // Persistence: reload and confirm it's still entered (from D1).
  await page.reload();
  await page.goto("/app/draw");
  await expect(page.getByRole("button", { name: /entered/i }).first()).toBeVisible({ timeout: 15000 });
});

test("4. Draw — map + plan-trip views render", async () => {
  await page.goto("/app/draw");
  await page.getByRole("button", { name: /^Map$/ }).click();
  // The map container (or its no-token fallback) mounts.
  await expect(page.locator(".mapboxgl-map, [class*='Map preview'], canvas").first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Plan trip/i }).click();
  await expect(page.getByText(/round-trip miles|rodeos this season/i)).toBeVisible();
  await page.getByRole("button", { name: /^List$/ }).click();
});

test("5. Buckle Board — ladders render", async () => {
  await page.goto("/app/buckle");
  await expect(page.getByRole("heading", { name: /road to the buckle/i })).toBeVisible();
  await expect(page.getByText(/District|State Finals|pts/i).first()).toBeVisible();
});

test("6. Tack Room — add a horse (persists), view run log", async () => {
  await page.goto("/app/tack");
  await page.getByRole("button", { name: /add a horse/i }).click();
  await page.getByPlaceholder(/barn name/i).fill("E2E Pony");
  await page.getByPlaceholder(/breed/i).fill("Quarter Horse");
  await page.getByRole("button", { name: /save horse/i }).click();
  await expect(page.getByText("E2E Pony").first()).toBeVisible();

  // Run-log tab.
  await page.getByRole("button", { name: /run log/i }).click();
  await expect(page.getByText(/Barrels|Tie-Down|footing|Ground/i).first()).toBeVisible();

  // Persistence across reload.
  await page.reload();
  await page.goto("/app/tack");
  await expect(page.getByText("E2E Pony").first()).toBeVisible({ timeout: 15000 });
});

test("7. More — alerts subscribe, Sponsor, Gatepost, Budget, Import", async () => {
  await page.goto("/app/more");
  await expect(page.getByRole("heading", { name: /the whole barn/i })).toBeVisible();

  // Enable alerts (the retention hook).
  const enable = page.getByRole("button", { name: /enable alerts|turn on alerts/i }).first();
  if (await enable.count()) {
    await enable.click();
    await expect(page.getByText(/your alerts|on\b/i).first()).toBeVisible({ timeout: 10000 });
  }

  // Sponsor Pen.
  await page.goto("/app/sponsor");
  await expect(page.getByRole("heading", { name: /partners/i })).toBeVisible();
  await expect(page.getByText(/media kit/i)).toBeVisible();

  // Gatepost — sign a petition.
  await page.goto("/app/gatepost");
  await expect(page.getByRole("heading", { name: /stand the ground/i })).toBeVisible();
  const sign = page.getByRole("button", { name: /add my name/i }).first();
  if (await sign.count()) {
    await sign.click();
    await expect(page.getByText(/your name is in/i).first()).toBeVisible();
  }

  // Budget.
  await page.goto("/app/budget");
  await expect(page.getByRole("heading", { name: /every dollar/i })).toBeVisible();

  // Import — load sample + synthesize with AI.
  await page.goto("/app/import");
  await expect(page.getByRole("heading", { name: /bring your history/i })).toBeVisible();
  await page.getByRole("button", { name: /load sample data/i }).click();
  await page.getByRole("button", { name: /synthesize/i }).click();
  await expect(page.getByText(/synthesized|records|detected/i).first()).toBeVisible({ timeout: 30000 });
});

test("8. session persists across a full reload, then sign out", async () => {
  await page.goto("/app");
  // Still signed in after a cold load (cookie/session).
  await expect(page.getByRole("button", { name: /^sign in$/i })).toHaveCount(0, { timeout: 15000 });

  // Open the account menu and sign out.
  await page.getByRole("button", { name: name.charAt(0) }).first().click().catch(() => {});
  const signOut = page.getByRole("button", { name: /sign out/i });
  if (await signOut.count()) {
    await signOut.click();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible({ timeout: 10000 });
  }
});
