import type { Context } from "hono";
import type { Env } from "./index";

// Self-contained auth: PBKDF2 password hashing + HMAC-signed session cookies.
// No external dependency. SESSION_SECRET (Worker secret) signs sessions; falls
// back to a fixed dev secret so it still works before the secret is set.

const COOKIE = "eight_session";
const DAY = 86400;

function secret(env: Env): string {
  return env.SESSION_SECRET || "8s-dev-session-secret-change-me";
}

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    key,
    256,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqual(hash, expectedHash);
}

async function sign(env: Env, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return b64url(sig);
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const body = `${userId}.${Date.now()}`;
  const payload = b64url(enc.encode(body));
  const sig = await sign(env, payload);
  return `${payload}.${sig}`;
}

export async function readSession(env: Env, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = await sign(env, payload);
  if (!timingSafeEqual(sig, expected)) return null;
  try {
    const body = new TextDecoder().decode(b64urlToBytes(payload));
    const [userId, tsStr] = body.split(".");
    const ts = Number(tsStr);
    if (!userId || !Number.isFinite(ts)) return null;
    if (Date.now() - ts > 30 * DAY * 1000) return null; // 30-day expiry
    return userId;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${30 * DAY}; SameSite=Lax; Secure; HttpOnly`;
}
export function clearCookie(): string {
  return `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
}

export function getCookie(c: Context<{ Bindings: Env }>, name = COOKIE): string | undefined {
  const header = c.req.header("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return v;
  }
  return undefined;
}

export async function currentUserId(c: Context<{ Bindings: Env }>): Promise<string | null> {
  return readSession(c.env, getCookie(c));
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
