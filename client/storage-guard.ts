import { readTicket, sameJson, SIDEBAR_KEY, ROUTE_KEY, type StoragePort } from "./launch";

// Paseo's no-op Zustand reconciliation still persists a whole sidebar snapshot. Defer
// those app writes while another window is hydrating our temporary launch preferences.
export function createLaunchWriteGuard(raw: StoragePort, now = Date.now) {
  const last = new Map([SIDEBAR_KEY, ROUTE_KEY].map((key) => [key, raw.getItem(key)]));
  const pending = new Map<string, string | null>();
  function active() { const ticket = readTicket(raw); return !!ticket && ticket.expiresAt > now(); }
  function persist(key: string, value: string | null) {
    if (value === null) raw.removeItem(key); else raw.setItem(key, value);
  }
  return {
    active,
    write(key: string, value: string | null): boolean {
      if (!last.has(key)) return false;
      const changed = !sameJson(last.get(key) ?? null, value);
      last.set(key, value);
      if (active()) {
        if (changed) pending.set(key, value);
      } else {
        pending.delete(key);
        persist(key, value);
      }
      return true;
    },
    flush() {
      if (active()) return;
      for (const [key, value] of pending) { persist(key, value); pending.delete(key); }
    },
  };
}
