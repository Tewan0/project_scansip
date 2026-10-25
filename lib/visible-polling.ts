// Refresh reads only while the page is visible and the browser is online.
// Reconnect/resume performs one immediate refresh; cleanup removes all listeners.
export function startVisiblePolling(refresh: () => void, intervalMs: number) {
  const run = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    refresh();
  };
  const timer = setInterval(run, intervalMs);
  if (typeof window !== "undefined") window.addEventListener("online", run);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", run);
  return () => {
    clearInterval(timer);
    if (typeof window !== "undefined") window.removeEventListener("online", run);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", run);
  };
}
