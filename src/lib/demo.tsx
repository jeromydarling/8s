import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { DemoDataset } from "@shared/types";
import { api } from "./api";

const UNLOCK_KEY = "eight_demo_unlocked";

export function isUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(UNLOCK_KEY) === "1";
}

export function unlockDemo(name?: string) {
  window.localStorage.setItem(UNLOCK_KEY, "1");
  if (name) window.localStorage.setItem("eight_demo_name", name);
}

export function demoName(): string {
  return window.localStorage.getItem("eight_demo_name") ?? "";
}

interface DemoState {
  data: DemoDataset | null;
  loading: boolean;
  error: string | null;
}

const DemoContext = createContext<DemoState>({ data: null, loading: true, error: null });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let alive = true;
    api
      .demo()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((err) =>
        alive && setState({ data: null, loading: false, error: String(err.message ?? err) }),
      );
    return () => {
      alive = false;
    };
  }, []);

  return <DemoContext.Provider value={state}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
