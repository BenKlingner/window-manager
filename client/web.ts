import { z } from "zod";
import { Platform } from "react-native";
import {
  ACK_KEY, LOCK_KEY, PENDING_KEY, WINDOW_KEY, launchWindows, readTicket, restoreTicket,
  type LaunchPort, type LaunchTicket, type StoragePort,
} from "./launch";
import type { WindowLaunch } from "../shared/settings";
import { createLaunchWriteGuard } from "./storage-guard";

// All undocumented desktop access is isolated here. No DOM imports or globals in UI components.
interface DesktopEnvironment {
  paseoDesktop?: { window?: { openNew?: () => Promise<void> } };
  localStorage?: StoragePort;
  sessionStorage?: StoragePort;
  crypto?: { randomUUID(): string };
  navigator?: { locks?: { request<T>(name: string, options: { ifAvailable: true }, callback: (lock: unknown | null) => Promise<T>): Promise<T> } };
  location?: { pathname: string };
}

function environment(): DesktopEnvironment { return Platform.OS === "web" ? globalThis as unknown as DesktopEnvironment : {}; }

interface GuardRegistration { raw: StoragePort; retain(): () => void }
const guardKey = Symbol.for("paseo-window-manager:storage-guard:v1");
function storageGuard(): GuardRegistration {
  const scope = globalThis as unknown as { [guardKey]?: GuardRegistration };
  if (scope[guardKey]) return scope[guardKey];
  const storage = environment().localStorage!;
  const prototype = Object.getPrototypeOf(storage) as StoragePort;
  const originalSet = prototype.setItem;
  const originalRemove = prototype.removeItem;
  const raw: StoragePort = {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => originalSet.call(storage, key, value),
    removeItem: (key) => originalRemove.call(storage, key),
  };
  const guard = createLaunchWriteGuard(raw);
  function set(this: StoragePort, key: string, value: string) {
    if (this !== storage || !guard.write(key, value)) originalSet.call(this, key, value);
  }
  function remove(this: StoragePort, key: string) {
    if (this !== storage || !guard.write(key, null)) originalRemove.call(this, key);
  }
  prototype.setItem = set;
  prototype.removeItem = remove;
  let references = 0;
  const registration: GuardRegistration = { raw, retain() {
    references += 1;
    let released = false;
    return () => { if (!released) { released = true; references -= 1; } };
  } };
  scope[guardKey] = registration;
  const timer = setInterval(() => {
    try {
      guard.flush();
      if (references || guard.active()) return;
      if (prototype.setItem === set) prototype.setItem = originalSet;
      if (prototype.removeItem === remove) prototype.removeItem = originalRemove;
      delete scope[guardKey];
      clearInterval(timer);
    } catch (error) { console.warn("[Window Manager] Could not finish deferred preferences", error); }
  }, 100);
  return registration;
}

export function desktopUnavailableReason(): string | null {
  try {
    const env = environment();
    if (typeof env.paseoDesktop?.window?.openNew !== "function") return "Open Paseo Desktop to launch windows. You can still manage saved sessions here.";
    if (!env.localStorage || !env.sessionStorage || !env.crypto?.randomUUID || !env.navigator?.locks) return "Window launching is unavailable in this desktop version.";
    return null;
  } catch { return "Paseo’s local window settings are unavailable."; }
}

export function newId(): string {
  const crypto = environment().crypto;
  if (crypto?.randomUUID) return crypto.randomUUID();
  // IDs identify UI records only, never permissions or launch tickets. Works on native settings screens.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function getWindowId(): string {
  const env = environment();
  const current = env.sessionStorage!.getItem(WINDOW_KEY);
  if (current) return current;
  const id = env.crypto!.randomUUID();
  env.sessionStorage!.setItem(WINDOW_KEY, id);
  return id;
}

const ackSchema = z.object({ token: z.string(), windowId: z.string() });
function isAcknowledged(storage: StoragePort, ticket: LaunchTicket): boolean {
  try {
    const value = ackSchema.parse(JSON.parse(storage.getItem(ACK_KEY) ?? "null"));
    return value.token === ticket.token && value.windowId !== ticket.senderId;
  } catch { return false; }
}

function waitForReady(storage: StoragePort, ticket: LaunchTicket, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearInterval(timer);
      signal.removeEventListener("abort", abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new Error("Window opening was cancelled."));
    const tick = () => {
      try {
        if (signal.aborted) return abort();
        if (isAcknowledged(storage, ticket)) return finish();
        if (Date.now() > ticket.expiresAt) finish(new Error("The new window did not finish loading. Check its connection before opening the session again."));
      } catch { finish(new Error("Could not check whether the new window finished loading.")); }
    };
    const timer = setInterval(tick, 100);
    signal.addEventListener("abort", abort, { once: true });
    tick();
  });
}

export function desktopPort(): LaunchPort {
  const reason = desktopUnavailableReason();
  if (reason) throw new Error(reason);
  const env = environment();
  const storage = storageGuard().raw;
  return {
    storage, windowId: getWindowId(),
    uuid: () => env.crypto!.randomUUID(), now: Date.now,
    openWindow: () => env.paseoDesktop!.window!.openNew!(),
    waitForReady: (ticket, signal) => waitForReady(storage, ticket, signal),
    exclusive: (operation) => env.navigator!.locks!.request(LOCK_KEY, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error("Another Paseo window is opening a session. Wait for it to finish, then try again.");
      return operation();
    }),
  };
}

export function startWindowReceiver(): () => void {
  if (desktopUnavailableReason()) return () => {};
  const env = environment();
  const guard = storageGuard();
  const releaseGuard = guard.retain();
  const storage = guard.raw;
  const wasKnown = env.sessionStorage!.getItem(WINDOW_KEY) !== null;
  const windowId = getWindowId();
  const ticket = readTicket(storage);
  let timer: ReturnType<typeof setInterval> | undefined;
  let stopped = false;

  // Existing windows and hot reloads must never acknowledge a new window's ticket.
  if (!wasKnown && ticket && ticket.senderId !== windowId && Date.now() < ticket.expiresAt) {
    timer = setInterval(() => {
      if (stopped || readTicket(env.localStorage!)?.token !== ticket.token || Date.now() > ticket.expiresAt) {
        if (timer !== undefined) clearInterval(timer); return;
      }
      // The startup router waits for workspace hydration. Reaching this route is the readiness signal.
      const path = env.location?.pathname ?? "";
      if (path === ticket.route || path.startsWith(ticket.route + "/")) {
        env.localStorage!.setItem(ACK_KEY, JSON.stringify({ token: ticket.token, windowId }));
        if (timer !== undefined) clearInterval(timer);
      }
    }, 100);
  }

  // Recover the temporary preference journal after a renderer crash. An active launcher holds this lock.
  void env.navigator!.locks!.request(LOCK_KEY, { ifAvailable: true }, async (lock) => {
    if (!lock || stopped) return;
    const abandoned = readTicket(env.localStorage!);
    if (abandoned) {
      restoreTicket(storage, abandoned);
      env.localStorage!.removeItem(PENDING_KEY);
      env.localStorage!.removeItem(ACK_KEY);
    }
  }).catch((error: unknown) => console.warn("[Window Manager] Could not recover a previous launch", error));

  return () => { stopped = true; releaseGuard(); if (timer !== undefined) clearInterval(timer); };
}

export interface LaunchState { busy: boolean; message: string | null; error: string | null }
export function createLauncher() {
  let state: LaunchState = { busy: false, message: null, error: null };
  const listeners = new Set<() => void>();
  const lifetime = new AbortController();
  const publish = (next: LaunchState) => { state = next; listeners.forEach((f) => f()); };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async run(prepare: () => Promise<WindowLaunch[]>) {
      if (state.busy) return;
      publish({ busy: true, message: "Preparing windows…", error: null });
      try {
        const port = desktopPort(); // Check capability before any SDK mutations.
        const targets = await prepare();
        await launchWindows(port, targets, lifetime.signal, (message) => publish({ busy: true, message, error: null }));
        publish({ busy: false, message: `Opened ${targets.length} window${targets.length === 1 ? "" : "s"}.`, error: null });
      } catch (error) {
        publish({ busy: false, message: null, error: error instanceof Error ? error.message : "Could not open windows." });
      }
    },
    dispose() { lifetime.abort(); listeners.clear(); },
  };
}
export type Launcher = ReturnType<typeof createLauncher>;
