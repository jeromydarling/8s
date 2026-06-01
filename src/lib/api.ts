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

  // Real events from D1 (Perplexity-seeded). Returns null when none exist yet,
  // so callers fall back to the bundled demo events.
  events: async (): Promise<RodeoEvent[] | null> => {
    try {
      const r = await jsonFetch<{ events: RodeoEvent[] | null }>("/api/events");
      return r.events && r.events.length ? r.events : null;
    } catch {
      return null;
    }
  },

  config: () =>
    jsonFetch<{ mapboxToken: string | null; mapsEnabled: boolean }>("/api/config").catch(() => ({
      mapboxToken: null,
      mapsEnabled: false,
    })),

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
};

// Bump alongside ART_VERSION in worker/art.ts to bust cached imagery.
export const artUrl = (slug: string) => `/api/art/${slug}?v=7`;
