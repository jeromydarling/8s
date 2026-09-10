import type { DemoDataset, ImportResult, Lead, RodeoEvent } from "@shared/types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  demo: () => jsonFetch<DemoDataset>("/api/demo"),

  submitLead: (lead: Lead) =>
    jsonFetch<{ ok: boolean; demoToken: string }>("/api/leads", {
      method: "POST",
      body: JSON.stringify(lead),
    }),

  importData: (text: string, filename: string) =>
    jsonFetch<ImportResult>("/api/import", {
      method: "POST",
      body: JSON.stringify({ text, filename }),
    }),

  // Persist a confirmed import into the signed-in user's roster.
  importConfirm: (records: Array<Record<string, string | number | null>>) =>
    jsonFetch<{ ok: boolean; added: { contestants: number; horses: number } }>("/api/import/confirm", {
      method: "POST",
      body: JSON.stringify({ records }),
    }),

  // Real events from D1 (Perplexity-seeded). Returns null when none exist yet,
  // so callers fall back to the bundled demo events.
  events: async (state?: string): Promise<RodeoEvent[] | null> => {
    try {
      const q = state ? `?state=${encodeURIComponent(state)}` : "";
      const r = await jsonFetch<{ events: RodeoEvent[] | null }>(`/api/events${q}`);
      return r.events && r.events.length ? r.events : null;
    } catch {
      return null;
    }
  },

  config: () =>
    jsonFetch<{ mapboxToken: string | null; mapsEnabled: boolean; billingEnabled: boolean }>("/api/config").catch(() => ({
      mapboxToken: null,
      mapsEnabled: false,
      billingEnabled: false,
    })),

  // Stripe Checkout: returns a hosted URL to redirect to. Association
  // site-licenses pass the org details so the webhook can provision the portal.
  checkout: (plan: "family" | "pro" | "associations", extra?: Record<string, string>) =>
    jsonFetch<{ url: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan, ...(extra ?? {}) }) }),
  // Stripe billing portal (manage/cancel) for existing subscribers.
  billingPortal: () => jsonFetch<{ url: string }>("/api/billing/portal", { method: "POST" }),
  // Cancel-save: pause 30 days, or downgrade to Free at period end.
  pauseBilling: () => jsonFetch<{ ok: boolean; paused_until: string }>("/api/billing/pause", { method: "POST" }),
  downgradeBilling: () => jsonFetch<{ ok: boolean }>("/api/billing/downgrade", { method: "POST" }),
  // Retention: the "Your Season" recap.
  recap: () =>
    jsonFetch<{ recap: null | Record<string, number | string> }>("/api/me/recap").catch(() => ({ recap: null })),

  addContestant: (c: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean; id: string }>("/api/contestants", { method: "POST", body: JSON.stringify(c) }),
  addHorse: (h: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean; id: string }>("/api/horses", { method: "POST", body: JSON.stringify(h) }),
  remove: (kind: "contestant" | "horse", id: string) =>
    jsonFetch<{ ok: boolean }>(`/api/${kind}/${id}`, { method: "DELETE" }),
  watch: (event_id: string, status?: string, force?: boolean) =>
    jsonFetch<{ ok: boolean; watching: boolean }>("/api/watch", {
      method: "POST",
      body: JSON.stringify({ event_id, status, force }),
    }),
  subscribeAlerts: (sub: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean }>("/api/alerts/subscribe", { method: "POST", body: JSON.stringify(sub) }),
  alerts: () => jsonFetch<{ alerts: Array<Record<string, unknown>> }>("/api/alerts").catch(() => ({ alerts: [] })),
  markAlertsRead: () => jsonFetch<{ ok: boolean }>("/api/alerts/read", { method: "POST" }),
  submitEvent: (e: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean }>("/api/submit-event", { method: "POST", body: JSON.stringify(e) }),

  // Gatepost petition signatures (persisted per signed-in user).
  signPetition: (arena_id: string, signed: boolean) =>
    jsonFetch<{ ok: boolean; signed: boolean }>("/api/gatepost/sign", { method: "POST", body: JSON.stringify({ arena_id, signed }) }),
  myPetitions: () => jsonFetch<{ arenas: string[] }>("/api/gatepost/mine").catch(() => ({ arenas: [] })),

  // ---- Associations (site-license), onboarding, data trust ----
  associations: () =>
    jsonFetch<{ associations: AssociationLite[] }>("/api/associations").catch(() => ({ associations: [] })),
  joinAssociation: (code: string) =>
    jsonFetch<{ ok: boolean; association: { id: string; name: string }; plan: string }>("/api/association/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
  onboarding: (p: { state?: string; disciplines?: string[]; code?: string }) =>
    jsonFetch<{ ok: boolean; joined: { id: string; name: string } | null; joinError: string | null }>("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(p),
    }),
  correct: (p: { target_type: "event" | "arena"; target_id: string; field: string; suggested_value?: string; note?: string }) =>
    jsonFetch<{ ok: boolean; id: string }>("/api/data/correct", { method: "POST", body: JSON.stringify(p) }),

  // Association portal (association admins only)
  portal: () => jsonFetch<PortalData>("/api/association/portal"),
  portalVerifyEvent: (id: string, fields: Record<string, string | number>) =>
    jsonFetch<{ ok: boolean }>(`/api/association/portal/event/${id}`, { method: "POST", body: JSON.stringify(fields) }),
  portalCreateEvent: (ev: Record<string, unknown>) =>
    jsonFetch<{ ok: boolean; id: string }>("/api/association/portal/events", { method: "POST", body: JSON.stringify(ev) }),
  portalRotateCode: () => jsonFetch<{ ok: boolean; invite_code: string }>("/api/association/portal/code", { method: "POST" }),
  portalRemoveFamily: (user_id: string) =>
    jsonFetch<{ ok: boolean }>("/api/association/portal/remove", { method: "POST", body: JSON.stringify({ user_id }) }),
  portalReviewCorrection: (id: string, action: "approve" | "reject") =>
    jsonFetch<{ ok: boolean }>(`/api/association/portal/correction/${id}`, { method: "POST", body: JSON.stringify({ action }) }),
};

export interface AssociationLite {
  id: string;
  name: string;
  abbreviation: string | null;
  state: string | null;
  verified: number;
}

export interface PortalEvent {
  id: string;
  name: string;
  association: string | null;
  city: string | null;
  state: string | null;
  venue: string | null;
  start_date: string | null;
  end_date: string | null;
  entry_deadline: string | null;
  fee_per_event: number | null;
  status: string | null;
  source: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export interface PortalData {
  association: { id: string; name: string; abbreviation: string | null; state: string | null; invite_code: string; seat_limit: number; verified: number; plan_status: string };
  seats: { used: number; limit: number };
  families: Array<{ id: string; name: string | null; email: string; state: string | null; plan: string; plan_source: string | null; last_active_at: string | null; created_at: string }>;
  events: PortalEvent[];
  corrections: Array<{ id: string; target_id: string; target_name: string | null; field: string; suggested_value: string | null; note: string | null; created_at: string }>;
}

// Bump alongside ART_VERSION in worker/art.ts to bust cached imagery.
export const artUrl = (slug: string) => `/api/art/${slug}?v=7`;
