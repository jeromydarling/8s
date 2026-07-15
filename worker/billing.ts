// 8 Seconds — Stripe billing endpoints.
// Plans:
//   - family       $79/yr  (Arena Family — competitive families)
//   - pro          $19.99/mo (Arena Pro — sponsorship toolkit)
//   - associations $49/mo  (event management, member db, draw tools)
// Free tier is no-checkout and is the default on signup.
//
// Endpoints (mounted under /api/billing in worker/index.ts):
//   GET  /plans     — public; returns labels + display prices.
//   POST /checkout  — requires session; creates/returns a Stripe Checkout URL.
//   POST /webhook   — Stripe → us. Verifies signature, updates users.plan.
//
// Degrades gracefully when Stripe keys are not yet set so MVP keeps running.

import type { Context } from "hono";
import type { Env } from "./index";
import { currentUserId } from "./auth";
import { stripe, stripeGet, StripeError, verifyStripeWebhook } from "./stripe";

type PlanId = "family" | "pro" | "associations";

export const PLANS: Record<
  PlanId,
  { label: string; price: string; priceIdVar: keyof Env }
> = {
  family: {
    label: "Arena Family",
    price: "$79/yr",
    priceIdVar: "STRIPE_PRICE_FAMILY",
  },
  pro: {
    label: "Arena Pro",
    price: "$19.99/mo",
    priceIdVar: "STRIPE_PRICE_PRO",
  },
  associations: {
    label: "Associations",
    price: "from $49/mo",
    priceIdVar: "STRIPE_PRICE_ASSOCIATIONS",
  },
};

export function getPlans(c: Context<{ Bindings: Env }>): Response {
  return c.json({
    plans: (Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(([id, p]) => ({
      id,
      label: p.label,
      price: p.price,
    })),
  });
}

export async function postCheckout(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);

  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: "Not signed in" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const plan = body?.plan as PlanId | undefined;
  if (!plan || !(plan in PLANS)) return c.json({ error: "Unknown plan" }, 422);

  const priceId = (c.env as unknown as Record<string, string | undefined>)[
    PLANS[plan].priceIdVar as string
  ];
  if (!c.env.STRIPE_SECRET_KEY || !priceId) {
    return c.json(
      {
        error: "billing_not_configured",
        message:
          "Stripe keys not set. Add STRIPE_SECRET_KEY and price IDs via `wrangler secret put`.",
      },
      503,
    );
  }

  try {
    // Fetch the user — email is required for Stripe customer creation; we also
    // reuse stripe_customer_id when available so we don't create duplicates.
    const u = (await db
      .prepare("SELECT id, email, name, stripe_customer_id, plan, plan_status FROM users WHERE id = ?")
      .bind(userId)
      .first()) as {
      id: string;
      email: string;
      name: string | null;
      stripe_customer_id: string | null;
      plan: string | null;
      plan_status: string | null;
    } | null;
    if (!u) return c.json({ error: "Not signed in" }, 401);

    // Block double-subscribe: an already-paying account should change plans via
    // the billing portal, not create a second Stripe subscription.
    if (u.plan && u.plan !== "free" && u.plan_status !== "canceled") {
      return c.json(
        { error: "already_subscribed", message: "You're already on a paid plan — manage it from the billing portal." },
        409,
      );
    }

    let customerId = u.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe<{ id: string }>(c.env, "customers", {
        email: u.email,
        ...(u.name ? { name: u.name } : {}),
        "metadata[user_id]": u.id,
        "metadata[app_slug]": "8seconds",
      });
      customerId = cust.id;
      await db
        .prepare("UPDATE users SET stripe_customer_id = ? WHERE id = ?")
        .bind(customerId, u.id)
        .run();
    }

    const appUrl = `https://${c.env.APP_DOMAIN || "8s.rodeo"}`;
    const session = await stripe<{ url?: string }>(c.env, "checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${appUrl}/app/more?upgrade=success`,
      cancel_url: `${appUrl}/app/more?upgrade=cancel`,
      "metadata[user_id]": u.id,
      "metadata[plan]": plan,
      "metadata[app_slug]": "8seconds",
      // Mirror onto the subscription so customer.subscription.* events carry
      // the same metadata as the checkout session.
      "subscription_data[metadata][user_id]": u.id,
      "subscription_data[metadata][plan]": plan,
      "subscription_data[metadata][app_slug]": "8seconds",
    });
    if (!session.url) return c.json({ error: "Stripe returned no URL" }, 502);
    return c.json({ url: session.url });
  } catch (e) {
    if (e instanceof StripeError) return c.json({ error: e.message }, (e.status as 400) || 500);
    throw e;
  }
}

// Opens the Stripe billing portal so an existing subscriber can update payment
// details or cancel. Needs only the stored customer id (no plan metadata).
export async function postPortal(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);

  const userId = await currentUserId(c);
  if (!userId) return c.json({ error: "Not signed in" }, 401);
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: "billing_not_configured" }, 503);
  }

  const u = (await db
    .prepare("SELECT stripe_customer_id FROM users WHERE id = ?")
    .bind(userId)
    .first()) as { stripe_customer_id: string | null } | null;
  if (!u?.stripe_customer_id) return c.json({ error: "No billing account yet." }, 400);

  const appUrl = `https://${c.env.APP_DOMAIN || "8s.rodeo"}`;
  try {
    const portal = await stripe<{ url?: string }>(c.env, "billing_portal/sessions", {
      customer: u.stripe_customer_id,
      return_url: `${appUrl}/app/more`,
    });
    if (!portal.url) return c.json({ error: "Stripe returned no URL" }, 502);
    return c.json({ url: portal.url });
  } catch (e) {
    if (e instanceof StripeError) return c.json({ error: e.message }, (e.status as 400) || 500);
    throw e;
  }
}

// Look up the customer id + their current active subscription. Returns nulls
// (never throws for "no sub") so the cancel-save UI degrades cleanly.
async function currentSub(
  c: Context<{ Bindings: Env }>,
): Promise<{ userId: string; customerId: string | null; subId: string | null } | null> {
  const db = c.env.DB;
  const userId = await currentUserId(c);
  if (!db || !userId || !c.env.STRIPE_SECRET_KEY) return null;
  const u = (await db.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").bind(userId).first()) as
    | { stripe_customer_id: string | null }
    | null;
  const customerId = u?.stripe_customer_id ?? null;
  let subId: string | null = null;
  if (customerId) {
    const subs = await stripeGet<{ data?: Array<{ id: string }> }>(c.env, "subscriptions", {
      customer: customerId,
      status: "active",
      limit: "1",
    });
    subId = subs.data?.[0]?.id ?? null;
  }
  return { userId, customerId, subId };
}

// Cancel-save option 1 — pause billing for 30 days instead of canceling. Keeps
// the relationship; Stripe voids invoices during the pause and auto-resumes.
export async function postPause(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);
  const ctx = await currentSub(c);
  if (!ctx) return c.json({ error: "Not signed in" }, 401);
  if (!ctx.subId) return c.json({ error: "No active subscription to pause." }, 400);
  const resumesAt = Math.floor((Date.now() + 30 * 86400_000) / 1000);
  try {
    await stripe(c.env, `subscriptions/${ctx.subId}`, {
      "pause_collection[behavior]": "void",
      "pause_collection[resumes_at]": String(resumesAt),
    });
  } catch (e) {
    if (e instanceof StripeError) return c.json({ error: e.message }, (e.status as 400) || 500);
    throw e;
  }
  const until = new Date(resumesAt * 1000).toISOString();
  await db.prepare("UPDATE users SET plan_status = 'paused', paused_until = ? WHERE id = ?").bind(until, ctx.userId).run();
  return c.json({ ok: true, paused_until: until });
}

// Cancel-save option 2 — downgrade to Free at period end. They keep everything
// they paid for until the renewal date; the webhook flips plan on deletion.
export async function postDowngrade(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);
  const ctx = await currentSub(c);
  if (!ctx) return c.json({ error: "Not signed in" }, 401);
  if (!ctx.subId) return c.json({ error: "No active subscription." }, 400);
  try {
    await stripe(c.env, `subscriptions/${ctx.subId}`, { cancel_at_period_end: "true" });
  } catch (e) {
    if (e instanceof StripeError) return c.json({ error: e.message }, (e.status as 400) || 500);
    throw e;
  }
  await db.prepare("UPDATE users SET plan_status = 'canceling' WHERE id = ?").bind(ctx.userId).run();
  return c.json({ ok: true });
}

// Stripe → us. Verifies signature (fails closed), then updates user plan based
// on session/subscription metadata. Never grants entitlement without a verified
// signature. checkout.session.completed marks the upgrade; subscription.deleted
// reverts back to "free". updated events refresh the latest plan.
export async function postWebhook(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.DB;
  if (!db) return c.json({ error: "unavailable" }, 503);

  const payload = await c.req.text();
  let event: Record<string, unknown>;
  try {
    event = await verifyStripeWebhook(c.env, payload, c.req.header("Stripe-Signature") ?? null);
  } catch (e) {
    const status = e instanceof StripeError ? e.status : 400;
    return c.json({ error: "webhook_verification_failed" }, (status as 400) || 400);
  }

  const type = event.type as string;
  const obj = (event.data as { object: Record<string, unknown> })?.object ?? {};
  const meta = (obj.metadata as Record<string, string>) ?? {};

  // Subscription events also carry status + renewal date; keep those in sync so
  // the CRM and the in-app plan card reflect reality (past_due, paused, renewal).
  const status = obj.status as string | undefined;
  const periodEnd = (obj.current_period_end as number | undefined) ??
    ((obj.items as { data?: Array<{ current_period_end?: number }> })?.data?.[0]?.current_period_end);
  const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  if (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    const userId = meta.user_id;
    const plan = meta.plan;
    if (userId && plan && plan in PLANS) {
      await db
        .prepare(
          "UPDATE users SET plan = ?, plan_status = COALESCE(?, plan_status), plan_renews_at = COALESCE(?, plan_renews_at), lifecycle = CASE WHEN lifecycle = 'churned' THEN 'won_back' ELSE lifecycle END WHERE id = ?",
        )
        .bind(plan, status ?? null, renewsAt, userId)
        .run();
    }
  } else if (type === "customer.subscription.deleted") {
    const userId = meta.user_id;
    if (userId) {
      await db
        .prepare("UPDATE users SET plan = 'free', plan_status = 'canceled', lifecycle = 'churned' WHERE id = ?")
        .bind(userId)
        .run();
    }
  }

  return c.json({ received: true });
}
