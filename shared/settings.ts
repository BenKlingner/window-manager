import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

const name = z.string().trim().min(1, "Enter a name.").max(80, "Use at most 80 characters.");
const id = z.string().min(1).max(200);
export const windowSchema = z.object({
  id, name,
  projectIds: z.array(id).min(1, "Choose at least one project for each group.").max(40)
    .refine((ids) => new Set(ids).size === ids.length, "A project is selected more than once."),
});
export const legacySessionSchema = z.object({
  id, name, windows: z.array(windowSchema).min(1).max(12)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});
export const sessionSchema = z.object({
  id, name,
  projectGroupIds: z.array(id).max(12, "Use at most 12 project groups per session.")
    .refine((ids) => new Set(ids).size === ids.length, "A project group is included more than once."),
});
export const preferencesSchema = z.object({
  projectGroups: z.array(windowSchema).max(400)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Project group IDs must be unique.").default([]),
  sessions: z.array(sessionSchema).max(30)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "Session IDs must be unique.").default([]),
  legacyWindowsImported: z.boolean().default(false),
}).superRefine((values, ctx) => {
  const groups = new Set(values.projectGroups.map((group) => group.id));
  for (const session of values.sessions) {
    if (session.projectGroupIds.some((id) => !groups.has(id))) {
      ctx.addIssue({ code: "custom", message: "A session references a missing project group." });
    }
  }
});

// Preserve each old window independently, even when IDs or names overlap across sessions.
export function migrateSessions(values: unknown) {
  const old = z.object({ sessions: z.array(legacySessionSchema).max(30).default([]) }).parse(values);
  const projectGroups: SavedWindow[] = [];
  const sessions = old.sessions.map((session, si) => ({
    id: session.id, name: session.name,
    projectGroupIds: session.windows.map((window, wi) => {
      const group = { ...window, id: `migrated-session-${si}-window-${wi}` };
      projectGroups.push(group);
      return group.id;
    }),
  }));
  return preferencesSchema.parse({ projectGroups, sessions });
}
export const preferences = defineSettings({
  id: "sessions", scope: "host", version: 2, schema: preferencesSchema,
  migrate(values, fromVersion) {
    if (fromVersion !== 1) throw new Error("Unsupported Window Manager settings version.");
    return migrateSessions(values);
  },
});

// Keep the old document registered as a read-only migration source.
export const windowPreferencesSchema = z.object({
  windows: z.array(windowSchema).max(40)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length).default([]),
});
export const windowPreferences = defineSettings({
  id: "windows", scope: "host", version: 1, schema: windowPreferencesSchema,
});
export function importLegacyWindows(values: Preferences, windows: SavedWindow[]): Preferences {
  if (values.legacyWindowsImported) return values;
  const used = new Set(values.projectGroups.map((group) => group.id));
  const imported = windows.map((window) => {
    let groupId = window.id;
    let suffix = 0;
    while (used.has(groupId)) groupId = `migrated-window-${++suffix}-${windows.indexOf(window)}`;
    used.add(groupId);
    return { ...window, id: groupId };
  });
  return preferencesSchema.parse({ ...values, projectGroups: [...values.projectGroups, ...imported], legacyWindowsImported: true });
}
export function sessionWindows(values: Preferences, session: SavedSession): SavedWindow[] {
  return session.projectGroupIds.map((id) => {
    const group = values.projectGroups.find((group) => group.id === id);
    if (!group) throw new Error("A project group is unavailable. Reload settings before launching.");
    return group;
  });
}
export type Preferences = z.infer<typeof preferencesSchema>;
export type SavedWindow = z.infer<typeof windowSchema>;
export type SavedSession = z.infer<typeof sessionSchema>;
export interface ProjectChoice { id: string; name: string; path: string; viewKey: string }
export interface WindowLaunch { name: string; hostId: string; projectKeys: string[]; workspaceId: string }
