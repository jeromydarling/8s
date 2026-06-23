// Stripe helpers — single source of truth for the Worker.
// Form-encodes params, checks res.ok, throws StripeError so callers can return
// a real error instead of silently shipping `{ url: undefined }` on failure.
//
// Webhook signature verification uses WebCrypto + constant-time compare and
// fails closed when STRIPE_WEBHOOK_SECRET is unset (no entitlements granted
// from forged POSTs). Modeled on the inmotu federation pattern.

import type { Env } from "./index";

export class StripeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

export async function stripe<T = Record<string, unknown>>(
  env: Env,
  path: string,
  params: Record<string, string>,
): Promise<T> {
  const key = env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe not configured", 503);

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.error as { message?: string })?.message ?? `Stripe error ${res.status}`;
    throw new StripeError(msg, res.status);
  }
  return body as T;
}

export async function verifyStripeWebhook(
  env: Env,
  payload: string,
  sigHeader: string | null,
  toleranceSec = 300,
): Promise<Record<string, unknown>> {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeError("Webhook secret not configured", 503);
  if (!sigHeader) throw new StripeError("Missing Stripe-Signature", 400);

  const parts = Object.fromEntries(
    sigHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k.trim(), v];
    }),
  ) as { t?: string; v1?: string };
  const ts = Number(parts.t);
  const given = parts.v1;
  if (!ts || !given) throw new StripeError("Malformed Stripe-Signature", 400);

  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > toleranceSec)
    throw new StripeError("Webhook timestamp outside tolerance", 400);

  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(`${ts}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (expected.length !== given.length) throw new StripeError("Signature mismatch", 400);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  if (diff !== 0) throw new StripeError("Signature mismatch", 400);

  return JSON.parse(payload) as Record<string, unknown>;
}
