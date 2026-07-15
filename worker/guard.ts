import type { Context } from "hono";
import type { Env } from "./index";

// Fail-closed admin-token check. The token now lives ONLY in a Worker secret
// (ART_INGEST_TOKEN), never in committed config. When the secret is unset, this
// returns false so the guarded route denies — previously an unset token +
// missing query param compared `undefined !== undefined` and silently PASSED.
export function tokenOk(c: Context<{ Bindings: Env }>): boolean {
  const expected = c.env.ART_INGEST_TOKEN;
  if (!expected) return false;
  const got = c.req.query("token");
  return !!got && got === expected;
}

// Best-effort per-isolate sliding-window rate limiter. Cloudflare runs many
// isolates, so this is a mitigation (stops naive scripted bursts hitting one
// isolate), not a hard guarantee — pair with Cloudflare WAF rate-limiting rules
// for production-grade protection. Zero-dependency and can't break a deploy.
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear(); // crude memory cap
  return true;
}

export function clientIp(c: Context<{ Bindings: Env }>): string {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
}
