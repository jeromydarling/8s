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
import { stripe, StripeError, verifyStripeWebhook } from "./stripe";

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
      .prepare("SELECT id, email, name, stripe_customer_id FROM users WHERE id = ?")
      .bind(userId)
      .first()) as {
      id: string;
      email: string;
      name: string | null;
      stripe_customer_id: string | null;
    } | null;
    if (!u) return c.json({ error: "Not signed in" }, 401);

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
      success_url: `${appUrl}/app/account?upgraded=1`,
      cancel_url: `${appUrl}/pricing`,
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

  if (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    const userId = meta.user_id;
    const plan = meta.plan;
    if (userId && plan && plan in PLANS) {
      await db.prepare("UPDATE users SET plan = ? WHERE id = ?").bind(plan, userId).run();
    }
  } else if (type === "customer.subscription.deleted") {
    const userId = meta.user_id;
    if (userId) {
      await db.prepare("UPDATE users SET plan = 'free' WHERE id = ?").bind(userId).run();
    }
  }

  return c.json({ received: true });
}
