import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { track } from "./track";

export interface User {
  id: string;
  email: string;
  name?: string;
  role?: string;
  state?: string;
  email_verified?: number;
  plan?: string;
}
export interface Contestant {
  id: string;
  first_name: string;
  last_name?: string;
  division?: string;
  disciplines?: string;
  associations?: string;
  back_number?: string;
}
export interface Horse {
  id: string;
  name: string;
  barn_name?: string;
  breed?: string;
  color?: string;
  role?: string;
  rider_id?: string;
  farrier_due?: string;
  vet_due?: string;
  notes?: string;
}
export interface WatchItem {
  event_id: string;
  status: string;
}

interface AccountData {
  user: User | null;
  contestants: Contestant[];
  horses: Horse[];
  watchlist: WatchItem[];
  alertSub: Record<string, unknown> | null;
}

interface AuthState extends AccountData {
  loading: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, extra?: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
}

const empty: AccountData = { user: null, contestants: [], horses: [], watchlist: [], alertSub: null };
const Ctx = createContext<AuthState>({ ...empty, loading: true, refresh: async () => {}, login: async () => {}, signup: async () => {}, logout: async () => {} });

async function post(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Request failed");
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AccountData>(empty);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/me");
      const d = (await res.json()) as AccountData;
      setData(d.user ? d : empty);
    } catch {
      setData(empty);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await post("/api/auth/login", { email, password });
    track("login");
    await refresh();
  }, [refresh]);

  const signup = useCallback(async (email: string, password: string, extra?: Record<string, unknown>) => {
    await post("/api/auth/signup", { email, password, ...extra });
    track("signup");
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await post("/api/auth/logout");
    track("logout");
    setData(empty);
  }, []);

  return (
    <Ctx.Provider value={{ ...data, loading, refresh, login, signup, logout }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
