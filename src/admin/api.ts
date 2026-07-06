// Admin CRM API client. All calls ride the existing session cookie; the server
// gates every route by the ADMIN_EMAILS allowlist.

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(b.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  state: string | null;
  plan: string;
  plan_status: string | null;
  plan_renews_at?: string | null;
  lifecycle: string;
  health_score: number | null;
  last_active_at: string | null;
  created_at: string;
  kids?: number;
  horses?: number;
}

export interface Metrics {
  totalUsers: number;
  paying: number;
  mrr: number;
  arr: number;
  churnRate: number;
  planMix: Record<string, number>;
  lifecycle: Record<string, number>;
  topStates: { state: string; n: number }[];
  signups: { ym: string; n: number }[];
}

export interface Msg {
  id: string;
  direction: string;
  channel: string;
  subject: string | null;
  body: string;
  author: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string | null;
  title: string;
  due_date: string | null;
  done_at: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  role: string | null;
  org: string | null;
  state: string | null;
  disciplines: string | null;
  stage: string;
  created_at: string;
}

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  approx: boolean;
  plan: string;
  lifecycle: string;
  health: number | null;
}

export interface CustomerDetail {
  user: Record<string, unknown>;
  contestants: Record<string, unknown>[];
  horses: Record<string, unknown>[];
  watch: { status: string; n: number }[];
  alertSub: Record<string, unknown> | null;
  messages: Msg[];
  tags: string[];
  tasks: Task[];
}

export const adminApi = {
  me: () => j<{ isAdmin: boolean; email?: string }>("/api/admin/crm/me").catch(() => ({ isAdmin: false })),
  customers: (q: { query?: string; plan?: string; lifecycle?: string; sort?: string }) => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return j<{ customers: Customer[] }>(`/api/admin/crm/customers${p ? `?${p}` : ""}`);
  },
  customer: (id: string) => j<CustomerDetail>(`/api/admin/crm/customer/${id}`),
  metrics: () => j<Metrics>("/api/admin/crm/metrics"),
  atRisk: () => j<{ customers: Customer[] }>("/api/admin/crm/at-risk"),
  map: () => j<{ pins: MapPin[] }>("/api/admin/crm/map"),
  message: (id: string, kind: "email" | "note", body: string, subject?: string) =>
    j<{ ok: boolean; delivered?: boolean }>(`/api/admin/crm/customer/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ kind, body, subject }),
    }),
  addTag: (id: string, tag: string) =>
    j<{ ok: boolean }>(`/api/admin/crm/customer/${id}/tags`, { method: "POST", body: JSON.stringify({ tag }) }),
  removeTag: (id: string, tag: string) =>
    j<{ ok: boolean }>(`/api/admin/crm/customer/${id}/tags`, { method: "DELETE", body: JSON.stringify({ tag }) }),
  setLifecycle: (id: string, lifecycle: string) =>
    j<{ ok: boolean }>(`/api/admin/crm/customer/${id}/lifecycle`, { method: "POST", body: JSON.stringify({ lifecycle }) }),
  tasks: () => j<{ tasks: Task[] }>("/api/admin/crm/tasks"),
  createTask: (title: string, user_id?: string, due_date?: string) =>
    j<{ ok: boolean }>("/api/admin/crm/tasks", { method: "POST", body: JSON.stringify({ title, user_id, due_date }) }),
  toggleTask: (id: string) => j<{ ok: boolean }>(`/api/admin/crm/task/${id}`, { method: "PATCH" }),
  leads: () => j<{ leads: Lead[] }>("/api/admin/crm/leads"),
  setLeadStage: (id: string, stage: string) =>
    j<{ ok: boolean }>(`/api/admin/crm/lead/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }),
};

export const LIFECYCLES = ["lead", "trial", "active", "at_risk", "churned", "won_back"] as const;
export const LEAD_STAGES = ["new", "contacted", "qualified", "converted", "archived"] as const;
export const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  family: "Arena Family",
  pro: "Arena Pro",
  associations: "Associations",
};

export function healthTone(h: number | null): string {
  if (h == null) return "text-ink/40";
  if (h >= 70) return "text-sage-deep";
  if (h >= 40) return "text-gold";
  return "text-rust";
}
export function lifecycleTone(l: string): "rust" | "gold" | "sage" | "turq" {
  return l === "at_risk" || l === "churned" ? "rust" : l === "lead" || l === "trial" ? "gold" : l === "won_back" ? "turq" : "sage";
}
