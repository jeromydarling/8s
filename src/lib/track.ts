// First-party analytics. Batches events and flushes to /api/track. Zero deps,
// no cookies beyond a random session id in sessionStorage.

interface Ev {
  name: string;
  path?: string;
  props?: Record<string, unknown>;
  session: string;
  referrer?: string;
}

function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let s = sessionStorage.getItem("eight_sid");
  if (!s) {
    s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("eight_sid", s);
  }
  return s;
}

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  timer = null;
  const body = JSON.stringify({ events: batch });
  // Prefer sendBeacon so events survive navigation.
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
  } else {
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
      () => {},
    );
  }
}

export function track(name: string, props?: Record<string, unknown>) {
  try {
    queue.push({
      name,
      path: location.pathname + location.hash,
      referrer: document.referrer || undefined,
      props,
      session: sessionId(),
    });
    if (!timer) timer = setTimeout(flush, 1500);
    if (queue.length >= 10) flush();
  } catch {
    /* never break UX */
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
