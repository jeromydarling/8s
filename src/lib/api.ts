import type { DemoDataset, ImportResult, Lead } from "@shared/types";

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
};

// Bump alongside ART_VERSION in worker/art.ts to bust cached imagery.
export const artUrl = (slug: string) => `/api/art/${slug}?v=4`;
