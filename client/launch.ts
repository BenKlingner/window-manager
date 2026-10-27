import { z } from "zod";
import type { WindowLaunch } from "../shared/settings";

export const SIDEBAR_KEY = "sidebar-view";
export const ROUTE_KEY = "paseo:last-workspace-route-selection";
export const PENDING_KEY = "paseo-window-manager:pending:v1";
export const ACK_KEY = "paseo-window-manager:ack:v1";
export const WINDOW_KEY = "paseo-window-manager:window:v1";
export const LOCK_KEY = "paseo-window-manager:launch:v1";

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// Mirrors Paseo's SidebarViewPersistedStateSchema (packages/app/src/stores/sidebar-view-store.ts).
// Paseo still accepts the legacy `label` mode, `hostFilter`, and `groupModeByServerId` on read, so
// a profile upgraded from an older release must not be rejected here.
const persistedGroupMode = z.enum(["project", "status", "label"]);
const sidebarSchema = z.object({
  version: z.literal(8),
  state: z.object({
    groupMode: persistedGroupMode.optional(),
    workspaceSort: z.enum(["manual", "created", "lastPrompt"]).optional(),
    showBackground: z.boolean().optional(),
    hostFilters: z.array(z.string()).optional(),
    hostFilter: z.string().nullable().optional(),
    projectFilters: z.array(z.string()).optional(),
    groupModeByServerId: z.record(z.string(), persistedGroupMode).optional(),
    labelFilter: z.object({ labels: z.array(z.string()) }).optional(),
  }).strict(),
}).strict();

export const ticketSchema = z.object({
  token: z.string().min(1).max(100),
  senderId: z.string().min(1).max(100),
  name: z.string().min(1).max(80),
  expiresAt: z.number(),
  route: z.string().min(1).max(2000),
  sidebarBefore: z.string().max(100_000).nullable(),
  sidebarApplied: z.string().max(100_000),
  routeBefore: z.string().max(10_000).nullable(),
  routeApplied: z.string().max(10_000),
}).strict();
export type LaunchTicket = z.infer<typeof ticketSchema>;

export function readTicket(storage: StoragePort): LaunchTicket | null {
  try {
    const raw = storage.getItem(PENDING_KEY);
    if (!raw || raw.length > 250_000) return null;
    const result = ticketSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

export function primeSidebar(raw: string | null, target: WindowLaunch): string {
  let decoded: unknown;
  try { decoded = raw === null ? { version: 8, state: {} } : JSON.parse(raw); }
  catch { throw new Error("Paseo’s sidebar settings could not be read. No windows were opened."); }
  const parsed = sidebarSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("This version of Paseo’s sidebar settings is not supported. No windows were opened.");
  if (!target.projectKeys.length || !target.hostId.trim()) throw new Error("Choose at least one project and a connected host.");
  // Drop legacy fields so the applied snapshot matches what Paseo itself writes today.
  const { hostFilter: _legacyHostFilter, groupModeByServerId: _legacyGroupModes, ...state } = parsed.data.state;
  return JSON.stringify({
    ...parsed.data,
    state: {
      ...state,
      workspaceSort: state.workspaceSort ?? "created",
      groupMode: "project", hostFilters: [target.hostId],
      projectFilters: [...new Set(target.projectKeys)], labelFilter: { labels: [] }, showBackground: false,
    },
  });
}

export function sameJson(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  // Key order can change when Paseo persists the hydrated object.
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)])) : value;
  try { return JSON.stringify(stable(JSON.parse(a))) === JSON.stringify(stable(JSON.parse(b))); }
  catch { return false; }
}

export function restoreTicket(storage: StoragePort, ticket: LaunchTicket): void {
  for (const [key, before, applied] of [
    [SIDEBAR_KEY, ticket.sidebarBefore, ticket.sidebarApplied],
    [ROUTE_KEY, ticket.routeBefore, ticket.routeApplied],
  ] as const) {
    // Preserve any real edits/navigation made by another window while we were opening this one.
    if (sameJson(storage.getItem(key), applied)) {
      if (before === null) storage.removeItem(key);
      else storage.setItem(key, before);
    }
  }
}

export interface LaunchPort {
  storage: StoragePort;
  windowId: string;
  uuid(): string;
  now(): number;
  openWindow(): Promise<void>;
  waitForReady(ticket: LaunchTicket, signal: AbortSignal): Promise<void>;
  exclusive<T>(operation: () => Promise<T>): Promise<T>;
}

export async function launchWindows(
  port: LaunchPort,
  targets: readonly WindowLaunch[],
  signal: AbortSignal,
  progress: (message: string) => void = () => {},
): Promise<void> {
  if (!targets.length || targets.length > 12) throw new Error("A session must contain 1–12 windows.");
  await port.exclusive(async () => {
    const abandoned = readTicket(port.storage);
    if (abandoned) {
      // A free Web Lock proves the previous launcher is no longer running.
      restoreTicket(port.storage, abandoned);
      port.storage.removeItem(PENDING_KEY);
      port.storage.removeItem(ACK_KEY);
    }
    let opened = 0;
    try {
      for (const target of targets) {
        if (signal.aborted) throw new Error("Window opening was cancelled.");
        progress(`Opening ${opened + 1} of ${targets.length}: ${target.name}`);
        const sidebarBefore = port.storage.getItem(SIDEBAR_KEY);
        const ticket: LaunchTicket = {
          token: port.uuid(), senderId: port.windowId, name: target.name,
          expiresAt: port.now() + 30_000,
          route: `/h/${encodeURIComponent(target.hostId)}/workspace/${encodeURIComponent(target.workspaceId)}`,
          sidebarBefore, sidebarApplied: primeSidebar(sidebarBefore, target),
          routeBefore: port.storage.getItem(ROUTE_KEY),
          routeApplied: JSON.stringify({ serverId: target.hostId, workspaceId: target.workspaceId }),
        };
        try {
          // Journal first so a crashed launcher can restore its temporary preferences.
          port.storage.setItem(PENDING_KEY, JSON.stringify(ticket));
          port.storage.removeItem(ACK_KEY);
          port.storage.setItem(SIDEBAR_KEY, ticket.sidebarApplied);
          port.storage.setItem(ROUTE_KEY, ticket.routeApplied);
          await port.openWindow();
          opened += 1;
          await port.waitForReady(ticket, signal);
        } finally {
          restoreTicket(port.storage, ticket);
          if (readTicket(port.storage)?.token === ticket.token) {
            port.storage.removeItem(PENDING_KEY);
            port.storage.removeItem(ACK_KEY);
          }
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "The window could not be opened.";
      throw new Error(`${opened ? `${opened} window${opened === 1 ? "" : "s"} opened. ` : ""}${detail}`);
    }
  });
}
